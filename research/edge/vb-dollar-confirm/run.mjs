// Edge research · vb-dollar-confirm: the two Equinox breakouts (gold T1, USD/JPY T1) split by whether the OTHER market's T1 had
// already filled that UTC day, the dollar-consistent way or not (PREREGISTRATION.md, committed alone first). Paper research only.
//   node research/edge/vb-dollar-confirm/run.mjs        (reads the shared toolkit's candle cache, EDGE_DATA)
// Base rules imported unchanged: gold-vol-breakout-hourcost/original.mjs + costs.mjs (gold T1, the trades built as tradesIn builds
// them, keeping the fill time) and run.mjs charge (route C1); usdjpy-vol-breakout-early/run.mjs trades (USD/JPY T1, fx cost).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { T1, medRange, daysOf as goldDaysOf, ORIG_SHA } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge, COSTS_SHA } from '../gold-vol-breakout-hourcost/run.mjs';
import { trades as jpyTrades } from '../usdjpy-vol-breakout-early/run.mjs';
import { buildDays as idxBuildDays } from '../index-vol-breakout/original.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), HC = path.join(HERE, '..', 'gold-vol-breakout-hourcost');
export const SLIP = 0.05, SEEDS = 40;
export const WIN = { DISC: ['2007-01-01', '2015-12-31'], CONF: ['2016-01-01', '2099-12-31'] };
export const HOURS = [['00-06', 0, 6], ['06-12', 6, 12], ['12-21', 12, 21]];
export const TESTS = { T1: ['xau', 'disagree'], T2: ['xau', 'none'], T3: ['usdjpy', 'disagree'], T4: ['usdjpy', 'none'] };
// harness gate: hourcost C1 per window (n, net R) and the USD/JPY studies' published results
export const GATE = [
  { mk: 'xau', src: 'gold-vol-breakout-hourcost C1 W1', w: ['2007-01-01', '2011-12-31'], n: 929, netR: 0.202 },
  { mk: 'xau', src: 'gold-vol-breakout-hourcost C1 W2', w: ['2012-01-01', '2015-12-31'], n: 728, netR: 0.170 },
  { mk: 'xau', src: 'gold-vol-breakout-hourcost C1 W3', w: ['2016-01-01', '2020-12-31'], n: 935, netR: 0.094 },
  { mk: 'xau', src: 'gold-vol-breakout-hourcost C1 W4', w: ['2021-01-01', '2026-11-12'], n: 1121, netR: 0.105 },
  { mk: 'usdjpy', src: 'usdjpy-vol-breakout-early 2005-2015', w: ['2005-01-04', '2015-12-31'], n: 2089, netR: 0.079 },
  { mk: 'usdjpy', src: 'fx-vol-breakout usdjpy 2016-2020', w: ['2016-01-01', '2020-12-31'], n: 955, netR: 0.036 },
  { mk: 'usdjpy', src: 'fx-vol-breakout usdjpy 2021 on', w: ['2021-01-01', '2026-11-19'], n: 1124, netR: 0.087 },
];
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const p2 = (t) => (Number.isFinite(t) ? 2 * O.normP(Math.abs(t)) : 1);

// gold T1 trades, the calls of costs.mjs tradesIn, keeping fillT; net under hourcost C1
export function goldTrades(days, cost) {
  const tr = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { ...T1, prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT);
    tr.push({ day: d.day, entry: x.entry, r: x.r, R: x.R, finR: x.finR, side: x.side, how: x.how, fillMin: x.fillMin, fillT: x.fillT, M: medRange(d.bars, i) });
  }
  const c = charge(tr, cost.profile, 'frac', cost.commission, SLIP);
  return tr.map((x, i) => { const net = c[i].net, ch = x.R - x.finR - net; return { mk: 'xau', day: x.day, side: x.side, fillT: x.fillT, R: x.R, net, net2: net - ch - x.finR }; });
}
export function usdjpyTrades(days) {
  return jpyTrades('usdjpy', days).map((x) => ({ mk: 'usdjpy', day: x.day, side: x.side, fillT: x.fillT, R: x.R, net: x.net, net2: x.net2 }));
}

// the group of each trade of A given B's trades: only B's fill candle start strictly before A's is read
export function tag(A, B) {
  const byDay = new Map(B.map((x) => [x.day, x]));
  return A.map((a) => {
    const b = byDay.get(a.day);
    const known = b && b.fillT < a.fillT;
    return { ...a, group: !known ? 'none' : a.side === -b.side ? 'agree' : 'disagree', otherFillT: known ? b.fillT : null };
  });
}

export function summ(tr) {
  const mt = O.monthT(tr), m2 = O.monthT(tr, 'net2');
  return { n: tr.length, netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))), net2R: r3(mean(tr.map((x) => x.net2))),
    total: r2(tr.reduce((s, x) => s + x.net, 0)), months: mt.months, t: r2(mt.t), tRaw: mt.t, t2x: r2(m2.t),
    buys: tr.filter((x) => x.side > 0).length, meanFillHour: r2(mean(tr.map((x) => (x.fillT % 86400) / 3600))) };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, tRaw: NaN };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: r3(d), t: se > 0 ? r2(d / se) : null, tRaw: se > 0 ? d / se : NaN };
}
export function placebo(pool, m, seeds = SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rand = O.rng(s), a = pool.map((x) => x.net);
    for (let i = 0; i < m; i++) { const j = i + Math.floor(rand() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
    out.push(mean(a.slice(0, m)));
  }
  return out;
}
const hourOf = (x) => (x.fillT % 86400) / 3600;

export function evaluate(tagged, other) {
  const W = {};
  for (const [w, rg] of Object.entries(WIN)) {
    const all = tagged.filter((x) => inW(x.day, rg)), g = (k) => all.filter((x) => x.group === k);
    const ag = g('agree'), cmp = g(other);
    const byHour = HOURS.map(([lab, a, b]) => { const f = (s) => s.filter((x) => hourOf(x) >= a && hourOf(x) < b);
      const A = f(ag), C = f(cmp); return { hours: lab, agreeN: A.length, otherN: C.length, ...welch(A.map((x) => x.net), C.map((x) => x.net)), tRaw: undefined }; });
    W[w] = { range: rg, all: summ(all), agree: summ(ag), disagree: summ(g('disagree')), none: summ(g('none')), diff: welch(ag.map((x) => x.net), cmp.map((x) => x.net)), byHour };
  }
  return W;
}

export function decide(res, pools) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => p2(res[k].windows.CONF.diff.tRaw)), adj = O.holm(ps), dec = {};
  ks.forEach((k, i) => {
    const Wn = res[k].windows, [mk, other] = TESTS[k], dD = Wn.DISC.diff.diff, dC = Wn.CONF.diff.diff;
    const keptName = dC > 0 ? 'agree' : other, kept = (w) => Wn[w][keptName];
    const pool = pools[mk].filter((x) => inW(x.day, WIN.CONF)), keptTr = pool.filter((x) => x.group === keptName);
    const pl = placebo(pool, keptTr.length), km = mean(keptTr.map((x) => x.net));
    const lines = {
      sameSign: dD != null && dC != null && Math.sign(dD) === Math.sign(dC) && dC !== 0,
      welch2: Math.abs(Wn.CONF.diff.tRaw) >= 2, holm: adj[i] < 0.05,
      keptPosBoth: kept('DISC').netR > 0 && kept('CONF').netR > 0, keptT2: kept('CONF').tRaw >= 2,
      n200: kept('CONF').n >= 200, cost2x: kept('CONF').net2R > 0, placebo38: pl.filter((v) => km > v).length >= 38,
    };
    const pass = Object.values(lines).every(Boolean);
    dec[k] = { kept: keptName, p: r3(ps[i]), pHolm: r3(adj[i]), lines, placeboBeaten: pl.filter((v) => km > v).length,
      verdict: pass ? 'PASS' : kept('CONF').n < 200 && lines.sameSign && lines.welch2 && lines.holm ? 'INCONCLUSIVE' : 'FAIL' };
  });
  return dec;
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const NAME = { xau: 'gold', usdjpy: 'USD/JPY' };
export function report(R) {
  const yn = (b) => (b ? 'yes' : 'no');
  const L = ['# Gold and USD/JPY breakouts, split by the other\'s earlier fill (vb-dollar-confirm, 24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, groups, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; the two forward records and the Equinox desks run on unchanged. This page is written by `run.mjs` from `result.json`.', '',
    'Groups for a trade of one market: **agree** = the other market\'s T1 filled earlier that UTC day the dollar-consistent way (gold up with USD/JPY down, or gold down with USD/JPY up); **disagree** = it filled earlier the other way; **none** = no earlier fill (later, the same 5-minute candle, or no trade). Only the other trade\'s fill time and side are read, never its result.', '',
    '## Groups (net R a trade after each desk\'s cost; month t on calendar-month sums)', '',
    '| Market | Window | All n / net | Agree n | Agree net | Agree gross | Agree 2x cost | Agree month t | Disagree n | Disagree net | None n | None net | Mean fill hour UTC (agree / disagree / none) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const mk of ['xau', 'usdjpy']) for (const w of ['DISC', 'CONF']) {
    const x = R.groups[mk][w];
    L.push(`| ${NAME[mk]} | ${w === 'DISC' ? 'discovery 2007-2015' : 'confirmation 2016-' + R.dataEnd} | ${x.all.n} / ${sg(x.all.netR)} | ${x.agree.n} | ${sg(x.agree.netR)} | ${sg(x.agree.grossR)} | ${sg(x.agree.net2R)} | ${sg(x.agree.t, 2)} | ${x.disagree.n} | ${sg(x.disagree.netR)} | ${x.none.n} | ${sg(x.none.netR)} | ${x.agree.meanFillHour} / ${x.disagree.meanFillHour} / ${x.none.meanFillHour} |`);
  }
  L.push('', '## The four tests', '', '| Test | Comparison | Discovery diff (Welch t) | Confirmation diff (Welch t) | p (two-sided) | Holm p | Better group | Same sign | Welch ≥ 2 | Holm < 0.05 | Better > 0 both | Better month t ≥ 2 | n ≥ 200 | 2x cost > 0 | Placebos beaten | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) {
    const T = R.tests[k], q = d.lines, [mk, other] = TESTS[k];
    L.push(`| ${k} | ${NAME[mk]}: agree − ${other} | ${sg(T.windows.DISC.diff.diff)} (${sg(T.windows.DISC.diff.t, 2)}) | ${sg(T.windows.CONF.diff.diff)} (${sg(T.windows.CONF.diff.t, 2)}) | ${d.p} | ${d.pHolm} | ${d.kept} | ${yn(q.sameSign)} | ${yn(q.welch2)} | ${yn(q.holm)} | ${yn(q.keptPosBoth)} | ${yn(q.keptT2)} | ${yn(q.n200)} | ${yn(q.cost2x)} | ${d.placeboBeaten} of 40 | ${d.verdict} |`);
  }
  L.push('', '## In plain words', '', R.reading, '', '## Within fill-hour blocks (confirmation; agree − comparison, net R, Welch t)', '', '| Test | 00-06 UTC | 06-12 UTC | 12-21 UTC |', '|---|---|---|---|');
  for (const k of Object.keys(R.tests)) L.push(`| ${k} | ` + R.tests[k].windows.CONF.byHour.map((h) => `${sg(h.diff)} (${sg(h.t, 2)}; n ${h.agreeN} / ${h.otherN})`).join(' | ') + ' |');
  L.push('', '## Harness gate (unconditioned rules against the published results)', '', '| Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |', '|---|---|---|---|---|');
  for (const g of R.gate) L.push(`| ${g.src} | ${g.w[0]} → ${g.w[1]} | ${g.n} / ${sg(g.netR)} | ${g.got.n} / ${sg(g.got.netR)} | ${yn(g.ok)} |`);
  L.push('', '## What this does NOT show', '',
    '- It does not re-test the breakouts: both rules were read on every year used here. Only the split by the other market\'s earlier fill is new.',
    '- A trade can only be "agree" or "disagree" after the other market filled, so those groups fill later in the day than "none" by construction; the fill-hour table is there to separate that from a dollar effect.',
    '- Costs: gold at the demo\'s measured 2026 hourly spreads and commission (slippage assumed), USD/JPY at the measured commission plus an assumed 0.5 pip; both charged on every year. OANDA mid candles, not broker ticks.',
    '- Nothing here is an edge on its own and nothing live changes; a before-cost tilt is not an edge.', '',
    '## Data and method', '', `- ${R.data}`, `- ${R.method}`, '- To repeat: `node research/edge/vb-dollar-confirm/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if (sha(path.join(HC, 'original.mjs')) !== ORIG_SHA || sha(path.join(HC, 'costs.mjs')) !== COSTS_SHA) throw new Error('pinned hourcost copies changed');
  const hc = JSON.parse(fs.readFileSync(path.join(HC, 'result.json'), 'utf8')), cost = { profile: hc.profile, commission: hc.commission };
  const rowsOf = (mk) => K.load(mk, '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const gRows = rowsOf('xau'), { days: gDays } = goldDaysOf(gRows);
  const gold = goldTrades(gDays, cost);
  const jRows = rowsOf('usdjpy').sort((a, b) => a[0] - b[0]), jLast = new Date(jRows.at(-1)[0] * 1000).toISOString().slice(0, 10);
  const jpy = usdjpyTrades(idxBuildDays(jRows).filter((d) => d.day < jLast));
  const gate = GATE.map((g) => { const a = (g.mk === 'xau' ? gold : jpy).filter((x) => inW(x.day, g.w)), n = a.length, netR = mean(a.map((x) => x.net));
    return { ...g, got: { n, netR: r3(netR) }, ok: Math.abs(n - g.n) <= 0.02 * g.n && Math.abs(netR - g.netR) <= 0.01 }; });
  const gateOk = gate.every((g) => g.ok);
  const pools = { xau: tag(gold, jpy), usdjpy: tag(jpy, gold) };
  const tests = {}; for (const [k, [mk, other]] of Object.entries(TESTS)) tests[k] = { market: mk, comparison: other, windows: evaluate(pools[mk], other) };
  const groups = { xau: tests.T1.windows, usdjpy: tests.T3.windows };
  const dec = decide(tests, pools);
  const dataEnd = [...gold, ...jpy].reduce((m, x) => (x.day > m ? x.day : m), '');
  const nPass = Object.values(dec).filter((d) => d.verdict === 'PASS').length;
  const word = !gateOk ? 'INCONCLUSIVE (harness gate missed)' : nPass ? `PASS, ${nPass} of 4` : Object.values(dec).every((d) => d.verdict === 'INCONCLUSIVE') ? 'INCONCLUSIVE' : 'FAIL, 0 of 4';
  const c = (k) => tests[k].windows.CONF, d = (k) => tests[k].windows.DISC;
  const verdict = `${word}: confirmation 2016 → ${dataEnd}, gold agree ${sg(c('T1').agree.netR)}R a trade (n ${c('T1').agree.n}) vs disagree ${sg(c('T1').disagree.netR)}R (n ${c('T1').disagree.n}, Welch t ${sg(c('T1').diff.t, 2)}) vs none ${sg(c('T1').none.netR)}R (n ${c('T1').none.n}); USD/JPY agree ${sg(c('T3').agree.netR)}R (n ${c('T3').agree.n}) vs disagree ${sg(c('T3').disagree.netR)}R (n ${c('T3').disagree.n}, t ${sg(c('T3').diff.t, 2)}) vs none ${sg(c('T3').none.netR)}R (n ${c('T3').none.n})`;
  const notMet = (k) => Object.entries(dec[k].lines).filter(([, b]) => !b).map(([x]) => x).join(', ') || 'none';
  const reading = Object.keys(TESTS).map((k) => `${k} (${NAME[TESTS[k][0]]}, agree − ${TESTS[k][1]}): discovery ${sg(d(k).diff.diff)}R (Welch t ${sg(d(k).diff.t, 2)}), confirmation ${sg(c(k).diff.diff)}R (t ${sg(c(k).diff.t, 2)}, Holm p ${dec[k].pHolm}); ${dec[k].verdict}, lines not met: ${notMet(k)}.`).join(' ') +
    ' The groups split trades that the base rules already take; a profitable group says nothing by itself, only the difference between groups does.' +
    ` Gold's "none" group (no earlier USD/JPY fill) fills earliest (mean ${c('T1').none.meanFillHour} h UTC in confirmation against ${c('T1').agree.meanFillHour} h for agree) and did best in both windows (${sg(d('T1').none.netR)}R and ${sg(c('T1').none.netR)}R a trade): the earlier-fill pattern holdout-vb-early already reported, not a dollar confirmation (T2's difference is not significant). A dollar-consistent earlier fill did not make either breakout measurably better.`;
  const R = { study: 'vb-dollar-confirm', built: '2026-11-24', preregistration: 'research/edge/vb-dollar-confirm/PREREGISTRATION.md', planSha256: sha(path.join(HERE, 'PREREGISTRATION.md')),
    verdict, verdictWord: word, dataEnd, gate, gateOk, windows: WIN, tests, groups, decision: dec, reading,
    data: `gold ${gold.length} T1 trades ${gold[0].day} → ${gold.at(-1).day}, USD/JPY ${jpy.length} T1 trades ${jpy[0].day} → ${jpy.at(-1).day}; the shared toolkit's OANDA mid M5 cache, the last day on file left out.`,
    method: 'Gold T1 built with the pinned hourcost copies (vbTrade k 0.5, both sides, out at 20:55 UTC), charged route C1 (measured hourly half-spreads at the fill hour and hour 20 + commission 0.000024 of price + 0.05 x the M5 median range + financing on buys). USD/JPY T1 from usdjpy-vol-breakout-early trades (out 21:00 UTC), cost 0.000045 x entry + 0.5 pip. Matched by UTC day; the other trade counts only when its fill candle started strictly before this one\'s. Welch t two-sided, normal p; Holm over T1-T4 on the confirmation p. Month t on calendar months with a trade. Placebo: 40 seeded random subsets of the market\'s confirmation trades of the better group\'s size.' };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  console.log(verdict);
  console.log(JSON.stringify(gate.map((g) => [g.src, g.n, g.got.n, g.netR, g.got.netR, g.ok])));
}
