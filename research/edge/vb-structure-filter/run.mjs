// Edge research · vb-structure-filter: the two passing breakout rules (gold T1, USD/JPY T1), kept only on the side of the H4
// swing structure (PREREGISTRATION.md, committed alone first). Paper research only: nothing live reads or changes.
//   node research/edge/vb-structure-filter/run.mjs            (reads the shared toolkit's candle cache, EDGE_DATA)
// Base rules are imported unchanged: gold-vol-breakout/run.mjs (buildDays, daySkip, vbTrade, monthT, normP, holm, rng) and
// fx-vol-breakout/run.mjs (trades, costPx) for USD/JPY. The H4 side is the toolkit's resample + structure.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildDays, daySkip, vbTrade, monthT, normP, holm, rng } from '../gold-vol-breakout/run.mjs';
import { trades as fxTrades, costPx as fxCostPx } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'usdjpy'];
export const GOLD_COST = 0.60;                                        // gold-vol-breakout COST ($ a round trip per ounce)
export const H4 = 14400, MIN_M5 = 12, KSW = 3, SEEDS = 40;
export const WIN = { REP: ['2010-01-01', '2019-12-31'], IS: ['2020-01-01', '2023-12-31'], OOS: ['2024-01-01', '2099-12-31'] };
export const GATE_TOL = { n: 0.02, netR: 0.01 };
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// cost a round trip in price units: the larger of the study's and the toolkit's (pre-registered)
export function costOf(mk, entry) {
  if (mk === 'xau') return Math.max(GOLD_COST, K.COSTS.xau);
  return Math.max(fxCostPx('usdjpy', entry), K.COSTS.usdjpy);
}

// H4 candles (UTC blocks, thin blocks dropped) and the structure side known after each closes
export function h4Side(m5) {
  const h4 = K.resample(m5, H4).filter((b) => b.n >= MIN_M5);
  const { side } = K.structure(h4, KSW);
  return { h4, side };
}
// the side of the last H4 candle that closed at or before moment d0 (0 when none)
export function sideAt(S, d0) { const n = K.closedCount(S.h4, d0); return n ? S.side[n - 1] : 0; }

// the exit time of a base trade, found the way the base rule's walk finds its exit (checked against its exit price)
export function exitTime(bars, x) {
  const i = bars.findIndex((b) => b.t === x.fillT), s = x.side, b0 = bars[i];
  if (s > 0 ? b0.l <= x.stop : b0.h >= x.stop) return b0.t + 300;
  for (let j = i + 1; j < bars.length; j++) {
    const b = bars[j];
    if (s * (b.o - x.stop) <= 0 || (s > 0 ? b.l <= x.stop : b.h >= x.stop)) return b.t + 300;
  }
  return bars.at(-1).t + 300;
}

// the base trades of one market (unfiltered), each tagged with the day's H4 side
export function marketTrades(mk, rows, S, { studyCost = false } = {}) {
  const lastDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
  const days = buildDays(rows).filter((d) => d.day < lastDay);
  const byDay = new Map(days.map((d) => [d.day, d]));
  let base;
  if (mk === 'xau') base = days.filter((d) => !daySkip(d)).map((d) => { const x = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: GOLD_COST }); return x.skip ? null : { day: d.day, ...x }; }).filter(Boolean);
  else base = fxTrades('usdjpy', days.filter((d) => d.day >= '2000-01-01'));       // fx-vol-breakout's own pool filters the window
  const out = [];
  for (const x of base) {
    const d = byDay.get(x.day);
    const c = studyCost ? (mk === 'xau' ? GOLD_COST : fxCostPx('usdjpy', x.entry)) : costOf(mk, x.entry);
    const net = x.R - c / x.r - (x.finR || 0), net2 = x.R - 2 * c / x.r - 2 * (x.finR || 0);
    const hs = sideAt(S, d.d0);
    out.push({ mk, day: x.day, side: x.side, fillT: x.fillT, entry: x.entry, stop: x.stop, target: null, exitT: exitTime(d.bars, x), exit: x.exit, how: x.how,
      r: x.r, R: x.R, net, net2, h4: hs, kept: hs !== 0 && hs === x.side });
  }
  return { trades: out, days, lastDay };
}

// fx-vol-breakout's pool only takes 2016 on; for the replication years the same rule is run on the earlier days too
function fxAll(days) {
  const tr = [];
  for (const d of days) {
    if (daySkip(d)) continue;
    const x = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    tr.push({ day: d.day, ...x });
  }
  return tr;
}

export function summ(tr) {
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R'), t2 = monthT(tr, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const v of [...tr].sort((a, b) => a.fillT - b.fillT).map((x) => x.net)) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months, t: r2(mt.t), tRaw: mt.t, grossT: r2(gt.t), t2x: r2(t2.t),
    maxDD: r2(dd), buys: side(1), sells: side(-1) };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: r3(d), t: se > 0 ? r2(d / se) : null };
}
export function placebo(base, m, seeds = SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rand = rng(s), a = base.map((x) => x.net);
    for (let i = 0; i < m; i++) { const j = i + Math.floor(rand() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
    out.push(mean(a.slice(0, m)));
  }
  return out;
}
export function byYear(tr) {
  const o = {}; for (const x of tr) { const y = x.day.slice(0, 4); (o[y] ||= { n: 0, t: 0 }); o[y].n++; o[y].t += x.net; }
  for (const y in o) o[y] = { n: o[y].n, netR: r3(o[y].t / o[y].n), total: r2(o[y].t) };
  return o;
}

// one test: base trades of its market(s), kept = on the H4 side
export function evaluate(base) {
  const res = { windows: {} };
  for (const [w, rg] of Object.entries(WIN)) {
    const all = base.filter((x) => inW(x.day, rg)), kept = all.filter((x) => x.kept), against = all.filter((x) => x.h4 !== 0 && !x.kept), zero = all.filter((x) => x.h4 === 0);
    const pl = placebo(all, kept.length), km = mean(kept.map((x) => x.net));
    res.windows[w] = { range: rg, unfiltered: summ(all), filtered: summ(kept), against: summ(against), droppedAgainst: against.length, droppedSide0: zero.length,
      keptMinusAgainst: welch(kept.map((x) => x.net), against.map((x) => x.net)), filteredMinusUnfiltered: r3(km - mean(all.map((x) => x.net))),
      placebo: { median: r3(pl.slice().sort((a, b) => a - b)[Math.floor(SEEDS / 2)]), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), beaten: pl.filter((v) => km > v).length },
      filteredByYear: byYear(kept), unfilteredByYear: byYear(all) };
  }
  const since = base.filter((x) => x.day >= WIN.REP[0]);
  res.pooled2010 = { keptMinusAgainst: welch(since.filter((x) => x.kept).map((x) => x.net), since.filter((x) => x.h4 !== 0 && !x.kept).map((x) => x.net)) };
  return res;
}
export function decide(tests) {
  const ks = Object.keys(tests), ps = ks.map((k) => normP(tests[k].windows.OOS.filtered.tRaw)), adj = holm(ps), dec = {};
  ks.forEach((k, i) => {
    const W = tests[k].windows, F = W.OOS.filtered;
    const profit = { oosPos: F.netR > 0, oosT2: F.tRaw >= 2, holm: adj[i] < 0.05, isPos: W.IS.filtered.netR > 0, cost2x: F.net2R > 0, n30: F.n >= 30, repPos: W.REP.filtered.netR > 0 };
    const kma = (w) => W[w].keptMinusAgainst.diff;
    const direction = { addsIS: kma('IS') > 0, addsOOS: kma('OOS') > 0, addsREP: kma('REP') > 0, welch2: (tests[k].pooled2010.keptMinusAgainst.t ?? -Infinity) >= 2, placebo38: W.OOS.placebo.beaten >= 38 };
    const pPass = Object.values(profit).every(Boolean), dPass = Object.values(direction).every(Boolean);
    dec[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), profit, direction, profitPass: pPass, directionPass: dPass, pass: pPass && dPass,
      verdict: pPass && dPass ? 'PASS' : !F.n || F.n < 30 ? 'INCONCLUSIVE' : pPass ? 'FAIL, direction adds nothing' : 'FAIL' };
  });
  return dec;
}

// harness gate: the unfiltered rules at the studies' own costs on the published windows
export const PUBLISHED = {
  xau: [{ src: 'gold-vol-breakout IS', w: ['2016-01-01', '2020-12-31'], n: 935, netR: 0.009 }, { src: 'gold-vol-breakout OOS', w: ['2021-01-01', '2026-11-12'], n: 1121, netR: 0.072 }],
  usdjpy: [{ src: 'fx-vol-breakout usdjpy IS', w: ['2016-01-01', '2020-12-31'], n: 955, netR: 0.036 }, { src: 'fx-vol-breakout usdjpy OOS', w: ['2021-01-01', '2026-11-19'], n: 1124, netR: 0.087 },
    { src: 'usdjpy-vol-breakout-early 2010-2015 (its byYear, the cache starts 2010)', w: ['2010-01-01', '2015-12-31'], n: 1119, netR: 0.0619 }],
};
export function gate(mk, studyTrades) {
  return PUBLISHED[mk].map((p) => {
    const a = studyTrades.filter((x) => inW(x.day, p.w)), n = a.length, netR = mean(a.map((x) => x.net));
    const ok = Math.abs(n - p.n) <= GATE_TOL.n * p.n && Math.abs(netR - p.netR) <= GATE_TOL.netR;
    return { ...p, got: { n, netR: r3(netR) }, ok };
  });
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# Breakouts on the side of the H4 structure (vb-structure-filter, 23 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. The rule, filter, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; the two forward records run on unchanged. This page is written by `run.mjs` from `result.json`.', '',
    '## The one table (net R a trade after each rule\'s own cost; month t on calendar-month sums)', '',
    '| Test | Window | Unfiltered n | Unfiltered net | Kept n | Kept net | Kept 2x cost | Kept gross | Kept month t | Against-side n | Against net | Kept − against (Welch t) | Placebos beaten |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, T] of Object.entries(R.tests)) for (const w of ['REP', 'IS', 'OOS']) {
    const x = T.windows[w];
    L.push(`| ${k} ${T.name} | ${w} ${x.range[0].slice(0, 4)}-${w === 'OOS' ? R.dataEnd : x.range[1].slice(0, 4)} | ${x.unfiltered.n} | ${sg(x.unfiltered.netR)} | ${x.filtered.n} | ${sg(x.filtered.netR)} | ${sg(x.filtered.net2R)} | ${sg(x.filtered.grossR)} | ${sg(x.filtered.t, 2)} | ${x.against.n} | ${sg(x.against.netR)} | ${sg(x.keptMinusAgainst.diff)} (${sg(x.keptMinusAgainst.t, 2)}) | ${x.placebo.beaten} of 40 |`);
  }
  L.push('', '## The bar, item by item (out of sample unless named)', '', '| Test | OOS p | Holm p | OOS > 0 | t ≥ 2 | Holm < 0.05 | IS > 0 | 2x cost > 0 | n ≥ 30 | REP > 0 | adds IS | adds OOS | adds REP | Welch t ≥ 2 (2010 → now) | 38 of 40 placebos | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, d] of Object.entries(R.decision)) { const p = d.profit, q = d.direction; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(p.oosPos)} | ${yn(p.oosT2)} | ${yn(p.holm)} | ${yn(p.isPos)} | ${yn(p.cost2x)} | ${yn(p.n30)} | ${yn(p.repPos)} | ${yn(q.addsIS)} | ${yn(q.addsOOS)} | ${yn(q.addsREP)} | ${yn(q.welch2)} (t ${sg(R.tests[k].pooled2010.keptMinusAgainst.t, 2)}) | ${yn(q.placebo38)} | ${d.verdict} |`); }
  L.push('', '## In plain words', '', R.reading, '');
  L.push('## Sides (kept and dropped, out of sample)', '');
  for (const [k, T] of Object.entries(R.tests)) { const x = T.windows.OOS; L.push(`- ${k}: kept buys n ${x.filtered.buys.n} ${sg(x.filtered.buys.netR)}R, kept sells n ${x.filtered.sells.n} ${sg(x.filtered.sells.netR)}R; dropped against-side buys n ${x.against.buys.n} ${sg(x.against.buys.netR)}R, sells n ${x.against.sells.n} ${sg(x.against.sells.netR)}R; days with side 0: ${x.droppedSide0}.`); }
  L.push('', '## By year (kept net R a trade, n; unfiltered beside it)', '', '| Year | ' + Object.keys(R.tests).map((k) => `${k} kept | ${k} all`).join(' | ') + ' |', '|---|' + Object.keys(R.tests).map(() => '---|---|').join(''));
  const ys = [...new Set(Object.values(R.tests).flatMap((T) => Object.values(T.windows).flatMap((x) => Object.keys(x.unfilteredByYear))))].sort();
  for (const y of ys) L.push(`| ${y} | ` + Object.values(R.tests).map((T) => { const w = Object.values(T.windows).find((x) => x.unfilteredByYear[y]); if (!w) return '— | —'; const a = w.filteredByYear[y], b = w.unfilteredByYear[y]; return `${a ? `${sg(a.netR)} (${a.n})` : '—'} | ${sg(b.netR)} (${b.n})`; }).join(' | ') + ' |');
  L.push('', '## Harness gate (unfiltered rules at the studies\' own costs, against the published results)', '', '| Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |', '|---|---|---|---|---|');
  for (const g of R.gate) L.push(`| ${g.src} | ${g.w[0]} → ${g.w[1]} | ${g.n} / ${sg(g.netR)} | ${g.got.n} / ${sg(g.got.netR)} | ${yn(g.ok)} |`);
  L.push('', '## What this does NOT show', '',
    '- It does not re-test the breakouts themselves: their trades were read before; only the split by the H4 side is new.',
    '- It tests ONE fixed reading of "direction" (the last break of a 3-a-side H4 swing, UTC-aligned blocks, known at 00:00 UTC). Other readings (Daily structure, a chain of timeframes, New York-aligned H4) are not covered, and trying them on these same trades now would be a search.',
    '- Costs are fixed figures charged on every year; no broker ticks. Past years are charged today\'s cost.',
    '- Whatever the verdict, nothing here is an edge on its own and nothing live changes; the forward records of the two unfiltered rules stay the judge.', '',
    '## Data and method', '', `- ${R.data}`, `- ${R.method}`, '- To repeat: `node research/edge/vb-structure-filter/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const tests = {}, all = [], gates = [], data = []; let dataEnd = null;
  for (const mk of MARKETS) {
    const m5 = K.load(mk, '5m');
    const rows = m5.map((b) => [b.t, b.o, b.h, b.l, b.c]);
    const S = h4Side(m5);
    const { trades, days, lastDay } = marketTrades(mk, rows, S);
    let tr = trades;
    if (mk === 'usdjpy') {                                    // add the 2010-2015 days fx-vol-breakout's pool leaves out
      const early = fxAll(days.filter((d) => d.day < '2016-01-01')), byDay = new Map(days.map((d) => [d.day, d]));
      const extra = early.map((x) => { const d = byDay.get(x.day), c = costOf(mk, x.entry), hs = sideAt(S, d.d0);
        return { mk, day: x.day, side: x.side, fillT: x.fillT, entry: x.entry, stop: x.stop, target: null, exitT: exitTime(d.bars, x), exit: x.exit, how: x.how, r: x.r, R: x.R, net: x.R - c / x.r, net2: x.R - 2 * c / x.r, h4: hs, kept: hs !== 0 && hs === x.side }; });
      tr = [...extra, ...trades];
    }
    // gate at the studies' own cost
    const studyTr = tr.map((x) => ({ ...x, net: x.R - (mk === 'xau' ? GOLD_COST : fxCostPx('usdjpy', x.entry)) / x.r }));
    gates.push(...gate(mk, studyTr));
    tests[mk === 'xau' ? 'T2' : 'T3'] = { name: mk === 'xau' ? 'gold' : 'USD/JPY', ...evaluate(tr) };
    all.push(...tr);
    dataEnd = dataEnd && dataEnd < lastDay ? dataEnd : lastDay;
    data.push(`${mk}: ${m5.length} M5 candles ${new Date(m5[0].t * 1000).toISOString().slice(0, 10)} → ${lastDay} (last day on file left out), ${S.h4.length} H4 candles`);
  }
  // dataEnd = the last complete day traded
  dataEnd = all.reduce((m, x) => (x.day > m ? x.day : m), '');
  all.sort((a, b) => a.fillT - b.fillT);
  const T1 = { name: 'gold + USD/JPY pooled', ...evaluate(all) };
  const ordered = { T1, T2: tests.T2, T3: tests.T3 };
  const dec = decide(ordered), gateOk = gates.every((g) => g.ok);
  const v = !gateOk ? 'INCONCLUSIVE' : dec.T1.verdict;
  const O = (k) => ordered[k].windows.OOS;
  const line = (k) => `${k} ${ordered[k].name}: kept ${sg(O(k).filtered.netR)}R a trade (n ${O(k).filtered.n}, month t ${sg(O(k).filtered.t, 2)}) against unfiltered ${sg(O(k).unfiltered.netR)}R (n ${O(k).unfiltered.n}); kept − against-side ${sg(O(k).keptMinusAgainst.diff)}R (Welch t ${sg(O(k).keptMinusAgainst.t, 2)}); 2010 → now Welch t ${sg(ordered[k].pooled2010.keptMinusAgainst.t, 2)}`;
  const verdict = `${v}${gateOk ? '' : ' (harness gate missed)'}: out of sample 2024 → ${dataEnd}, ${line('T1')}`;
  const fails = (k) => [...Object.entries(dec[k].profit), ...Object.entries(dec[k].direction)].filter(([, b]) => !b).map(([c]) => c).join(', ') || 'none';
  const reading = `T1 (both markets pooled, the primary test): ${dec.T1.verdict}; items not met: ${fails('T1')}. T2 gold: ${dec.T2.verdict} (not met: ${fails('T2')}). T3 USD/JPY: ${dec.T3.verdict} (not met: ${fails('T3')}). ` +
    `${line('T1')}. ${line('T2')}. ${line('T3')}. ` +
    `Replication 2010-2019, kept minus against-side: T1 ${sg(ordered.T1.windows.REP.keptMinusAgainst.diff)}R (t ${sg(ordered.T1.windows.REP.keptMinusAgainst.t, 2)}), in sample 2020-2023 ${sg(ordered.T1.windows.IS.keptMinusAgainst.diff)}R (t ${sg(ordered.T1.windows.IS.keptMinusAgainst.t, 2)}). ` +
    'The filtered trades are a subset of rules that already pass, so a profitable filtered rule says nothing about direction; only the kept-versus-against comparison does. Read it as the pre-registration says: unless every direction item holds, trading only with the H4 structure adds nothing that can be told from chance to these breakouts.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'vb-structure-filter', built: '2026-11-23', preregistration: 'research/edge/vb-structure-filter/PREREGISTRATION.md', planSha256: sha, verdict, verdictWord: v, dataEnd,
    data: data.join('; ') + '. Source: the shared toolkit\'s OANDA mid M5 cache.',
    method: 'Base rules imported unchanged (gold-vol-breakout vbTrade k 0.5, out 20:55 UTC; fx-vol-breakout trades for USD/JPY, the same rule on its 2010-2015 days). H4 = toolkit resample(m5, 14400), blocks under 12 M5 candles dropped; side = toolkit structure(h4, 3); a day takes the side of the last H4 candle closed at or before its 00:00 UTC. Kept = first fill on that side; side 0 = no trade. Cost: gold $0.60, USD/JPY max(0.000045 × entry + 0.005, 0.008) a round trip; 2x reported. Month t on calendar months with a trade; p one-sided normal; Holm over T1-T3 on the OOS p. Placebo: 40 seeded random subsets of the window\'s unfiltered trades of the kept size.',
    windows: WIN, costs: { xau: GOLD_COST, usdjpy: 'max(0.000045 x entry + 0.005, 0.008)' }, gate: gates, gateOk, decision: dec, tests: ordered, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  const slim = all.map((x) => ({ market: x.mk, side: x.side, entryT: x.fillT, entry: x.entry, stop: x.stop, target: null, exitT: x.exitT, exit: x.exit, how: x.how, R: r3(x.R), Rnet: r3(x.net), h4Side: x.h4, kept: x.kept }));
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(slim) + '\n');
  console.log(verdict);
  console.log(JSON.stringify(gates.map((g) => [g.src, g.n, g.got.n, g.netR, g.got.netR, g.ok])));
}
