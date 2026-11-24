// Edge research · usdjpy-weekly-vb: gold-weekly-vol-breakout's weekly rule (T1: k 0.5, both sides), imported unchanged, on
// OANDA mid USD/JPY M5, after fx-vol-breakout's cost and an assumed 1 %-a-year financing (PREREGISTRATION.md, pushed alone
// first). Paper research only.
//   node research/edge/usdjpy-weekly-vb/run.mjs   (reads the edgekit candle cache; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildWeeks, weekSkip, wvbTrade, marketTrade, monthT, normP, holm, rng, placeboEnd, exitMonthOf } from '../gold-weekly-vol-breakout/run.mjs';
import { buildDays, daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { costPx, charge } from '../fx-vol-breakout/run.mjs';
import { nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const K = 0.5, MK = 'usdjpy', FIN_YEAR = 0.01, SEEDS = 40;
export const W = { D: ['2005-01-03', '2014-12-31'], C: ['2015-01-05', '2099-12-31'] };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// cost + assumed financing (either side) in R, from the gross R of a trade { R, entry, r, fillT, exitT }
export function finPx(entry, fillT, exitT) { return nights(fillT, exitT) * FIN_YEAR / 365 * entry; }
export function chargeW(x) {
  const c = costPx(MK, x.entry), f = finPx(x.entry, x.fillT, x.exitT);
  return { ...x, nightsN: nights(x.fillT, x.exitT), costR: c / x.r, finR: f / x.r, netPreFin: x.R - c / x.r, net: x.R - (c + f) / x.r, net2: x.R - 2 * (c + f) / x.r };
}
export function weeklyTrades(weeks) {
  const tr = [], skips = {};
  for (const w of weeks) {
    if (w.week < W.D[0]) continue;
    const s = weekSkip(w); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    const x = wvbTrade(w.bars, { k: K, sides: 'both', prevRange: w.prevRange, cost: 0 });
    if (x.skip) { skips[x.skip] = (skips[x.skip] || 0) + 1; continue; }
    tr.push({ week: w.week, exitMonth: exitMonthOf(w, x), ...chargeW({ R: x.R, entry: x.entry, r: x.r, side: x.side, fillT: x.fillT, exitT: x.exitT, how: x.how }) });
  }
  return { tr, skips };
}
export function placebo(weeks, oos, seeds = SEEDS) {
  const byWeek = new Map(weeks.map((w) => [w.week, w])), pBuy = oos.filter((x) => x.side > 0).length / (oos.length || 1), res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const x of oos) {
      const w = byWeek.get(x.week), cand = w.bars.filter((b) => b.t <= placeboEnd(w.m));
      const b = cand[Math.floor(rand() * cand.length)], side = rand() < pBuy ? 1 : -1;
      const p = marketTrade(w.bars, { startT: b.t, side, dist: x.r, cost: 0 }); if (!p) continue;
      tr.push(chargeW({ R: p.R, entry: p.entry, r: p.r, side, fillT: p.fillT, exitT: p.exitT }));
    }
    res.push(r3(mean(tr.map((v) => v.net))));
  }
  return res;
}
export function summary(tr) {
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R'), pf = monthT(tr, 'netPreFin');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))),
    preFinR: r3(mean(tr.map((x) => x.netPreFin))), netR: r3(mean(net)), net2R: r3(mean(tr.map((x) => x.net2))),
    costR: r3(mean(tr.map((x) => x.costR))), finR: r3(mean(tr.map((x) => x.finR))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: mt.months, t: r2(mt.t), grossT: r2(gt.t), preFinT: r2(pf.t), maxDD: r2(dd),
    stops: tr.filter((x) => x.how === 'stop').length, time: tr.filter((x) => x.how === 'time').length,
    medianStopPips: tr.length ? r2([...tr.map((x) => x.r)].sort((a, b) => a - b)[Math.floor(tr.length / 2)] * 100) : null, buys: side(1), sells: side(-1) };
}
export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : null;
}
const DAY = 86400;
const mondayKey = (t) => { const d0 = Math.floor(t / DAY) * DAY, wd = new Date(d0 * 1000).getUTCDay(); return new Date((wd === 0 ? d0 + DAY : d0 - ((wd + 6) % 7) * DAY) * 1000).toISOString().slice(0, 10); };
export function correlation(weekly, daily, win) {
  const wk = weekly.filter((x) => inW(x.week, win)), dl = daily.filter((x) => inW(x.day, win));
  const dW = new Map(), dM = new Map(), wM = new Map();
  for (const x of dl) { const k = mondayKey(x.d0); dW.set(k, (dW.get(k) || 0) + x.net); const m = x.day.slice(0, 7); dM.set(m, (dM.get(m) || 0) + x.net); }
  for (const x of wk) wM.set(x.exitMonth, (wM.get(x.exitMonth) || 0) + x.net);
  const pw = wk.filter((x) => dW.has(x.week)), pm = [...wM.keys()].filter((m) => dM.has(m));
  return { weeks: pw.length, weekCorr: r3(pearson(pw.map((x) => x.net), pw.map((x) => dW.get(x.week)))),
    months: pm.length, monthCorr: r3(pearson(pm.map((m) => wM.get(m)), pm.map((m) => dM.get(m)))) };
}
export function decide(res, pl) {
  const c = res.C, d = res.D, p = normP(c.t), [ph] = holm([p]), beaten = pl.filter((v) => c.netR > v).length;
  const checks = { bothPos: d.netR > 0 && c.netR > 0, t2: c.t >= 2, holm: ph < 0.05, n200: c.n >= 200, cost2x: c.net2R > 0, placebo: beaten >= 38 };
  return { p: r3(p), pHolm: r3(ph), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
}

const sg = (v, k = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(k));
export function verdictLine(R) {
  const c = R.windows.C, d = R.windows.D;
  return `${R.decision.pass ? 'PASS' : 'FAIL'}: USD/JPY weekly breakout (week open ± 0.5 × prior week range) 2015 → now ${sg(c.netR)}R a trade after costs and financing (n ${c.n}, month t ${sg(c.t, 2)}); 2005-14 ${sg(d.netR)}R (n ${d.n}, t ${sg(d.t, 2)})`;
}
export function report(R) {
  const L = [], yn = (b) => (b ? 'yes' : 'no');
  L.push('# USD/JPY: the weekly volatility breakout (week open ± 0.5 × the previous week\'s range)', '');
  L.push('Paper research only. `gold-weekly-vol-breakout`\'s weekly rule (T1), imported unchanged, on USD/JPY: the one forex market where the daily T1 holds. Rule, costs, windows, control and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). Nothing live changed. Written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('| Window | n | Win | Gross R | After cost, before financing | Net R (after both) | Net 2x | Cost R | Financing R | Total R | Month t (net) | Month t (gross) | Month t (before fin.) | Max DD R | Median stop pips | Buys | Sells |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, name] of [['D', 'Discovery 2005-2014'], ['C', `Confirmation 2015 → ${R.dataEnd}`]]) {
    const x = R.windows[k];
    L.push(`| ${name} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.grossR)} | ${sg(x.preFinR)} | ${sg(x.netR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${sg(x.finR)} | ${sg(x.total, 2)} | ${sg(x.t, 2)} | ${sg(x.grossT, 2)} | ${sg(x.preFinT, 2)} | ${sg(x.maxDD, 2)} | ${x.medianStopPips} | ${x.buys.n} ${sg(x.buys.netR)} | ${x.sells.n} ${sg(x.sells.netR)} |`);
  }
  const D = R.decision, c = D.checks;
  L.push('', '## Decision (confirmation)', '');
  L.push(`One-sided p ${D.p}, Holm (one test) ${D.pHolm}. Placebo (40 seeds, random 5-minute entry in the same week, the real 1R, the same costs): beats ${D.placeboBeaten} of 40 (38 needed); placebo median ${sg(R.placebo.median)}, 95th percentile ${sg(R.placebo.p95)}.`, '');
  L.push(`Checks: positive in both windows ${yn(c.bothPos)}, month t ≥ 2 ${yn(c.t2)}, Holm < 0.05 ${yn(c.holm)}, n ≥ 200 ${yn(c.n200)}, 2x cost > 0 ${yn(c.cost2x)}, placebo ${yn(c.placebo)}.`, '');
  L.push('## Correlation with the daily USD/JPY T1 (descriptive)', '');
  L.push('Daily T1 (k 0.5, out at 21:00 UTC, `fx-vol-breakout` cost) net R summed by the same Monday-keyed week, against the weekly trade\'s net R (weeks where both traded); and calendar-month sums (months where both traded).', '');
  L.push('| Window | Daily T1 n / net R | Weeks | Weekly corr | Months | Monthly corr |', '|---|---|---|---|---|---|');
  for (const [k, name] of [['D', '2005-2014'], ['C', '2015 → now'], ['ALL', 'All']]) { const x = R.correlation[k], d = R.daily[k]; L.push(`| ${name} | ${d.n} / ${sg(d.netR)} | ${x.weeks} | ${sg(x.weekCorr)} | ${x.months} | ${sg(x.monthCorr)} |`); }
  L.push('', '## By year (net R a trade, n)', '', '| Year | n | Net R | Total |', '|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.netR)} | ${sg(v.total, 2)} |`);
  L.push('', `Skipped weeks: ${Object.entries(R.skips).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  L.push('## Reading', '', R.reading, '');
  L.push(`Data: OANDA mid USD/JPY M5 (edgekit cache), ${R.dataStart} → ${R.dataEnd}. Cost: 0.000045 × entry + 0.005 a round trip (fx-vol-breakout). Financing: ASSUMED 1 % a year of the entry either side, ${'nights()'} rollovers (Wednesday three); not measured on the broker. Weeks keyed by their Monday; month t on exit months.`);
  return L.join('\n') + '\n';
}

export async function main() {
  const { load } = await import('../_lib/edgekit.mjs');
  const bars = load(MK, '5m', { from: '2004-12-27', to: '2026-12-31' }), rows = bars.map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const weeks = buildWeeks(rows), { tr, skips } = weeklyTrades(weeks);
  const D = tr.filter((x) => inW(x.week, W.D)), C = tr.filter((x) => inW(x.week, W.C));
  const windows = { D: summary(D), C: summary(C) }, pl = placebo(weeks, C), decision = decide(windows, pl);
  const days = buildDays(rows), daily = [];
  for (const d of days) { if (d.day < W.D[0] || daySkip(d)) continue; const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (!x.skip) daily.push({ day: d.day, d0: d.d0, ...charge(MK, x) }); }
  const dsum = (w) => { const a = daily.filter((x) => inW(x.day, w)); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  const ALL = [W.D[0], W.C[1]];
  const byYear = {}; for (const x of tr) { const y = x.week.slice(0, 4); (byYear[y] ||= { n: 0, s: 0 }); byYear[y].n++; byYear[y].s += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].s / byYear[y].n), total: r2(byYear[y].s) };
  const sorted = [...pl].sort((a, b) => a - b);
  const R = { study: 'usdjpy-weekly-vb', builtFrom: 'gold-weekly-vol-breakout (buildWeeks, weekSkip, wvbTrade, marketTrade) + fx-vol-breakout cost',
    prereg: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    dataStart: new Date(bars[0].t * 1000).toISOString().slice(0, 10), dataEnd: new Date(bars.at(-1).t * 1000).toISOString().slice(0, 10),
    k: K, finYear: FIN_YEAR, windows, decision, skips, byYear,
    placebo: { means: pl, median: r3(sorted[19] / 2 + sorted[20] / 2), p95: r3(sorted[Math.floor(0.95 * 39)]) },
    daily: { D: dsum(W.D), C: dsum(W.C), ALL: dsum(ALL) },
    correlation: { D: correlation(tr, daily, W.D), C: correlation(tr, daily, W.C), ALL: correlation(tr, daily, ALL) } };
  R.verdict = verdictLine(R);
  R.reading = decision.pass
    ? 'All pre-registered checks pass. A candidate for its own forward paper record at most; never a live rule without the owner. Limits: today\'s cost on old years, OANDA mid candles, assumed financing.'
    : `The weekly rule does not carry the daily result to USD/JPY on the pre-registered bar (failed: ${Object.entries(decision.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}). Nothing is tuned after this; no other k or side is looked at on these years. Any before-cost tilt is not an edge.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict); console.log(JSON.stringify({ decision, corr: R.correlation, daily: R.daily }, null, 1));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
