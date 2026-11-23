// Edge research · holdout-vb-early: the volatility breakout (gold-vol-breakout vbTrade, k 0.5, both sides, stop at the
// day's open, out at 21:00 UTC) taken only when a stop order fills before 06:00 UTC, on the untouched holdout
// (PREREGISTRATION.md, committed alone first). Paper research only: nothing live reads or changes.
//   node research/edge/holdout-vb-early/run.mjs        (reads the shared toolkit's candle cache, EDGE_DATA, out of git)
// Base rule imported unchanged: gold-vol-breakout/run.mjs (buildDays, daySkip, vbTrade); forex cost from
// fx-vol-breakout/run.mjs (costPx). Both pinned by sha256 below. The phase reader (research/edge/_lib/phase.mjs) tags each
// trade with the D1 / H4 reading known at the day's 00:00 UTC: a description, never part of the verdict.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { buildDays, daySkip, vbTrade } from '../gold-vol-breakout/run.mjs';
import { costPx as fxCostPx } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDGE = path.join(HERE, '..');
export const PINS = { 'gold-vol-breakout/run.mjs': 'afa36e031e39daab', 'fx-vol-breakout/run.mjs': '5ecca28799940b38' };
export const CUT_S = 6 * 3600;               // both orders cancelled at 06:00 UTC: a fill candle must start before it
export const KV = 0.5;
export const SETS = {
  A: { name: 'Set A, early years (2005-2009, the five main markets)', markets: K.MARKETS, from: '2005-01-01', to: '2009-12-31', load: { from: '2004-11-01', to: '2010-01-01' } },
  B: { name: 'Set B, fresh markets (2010 → now)', markets: K.HOLDOUT_MARKETS, from: '2010-01-01', to: '2099-12-31', load: { from: '2009-11-01' } },
};
export const GOLD_COST = 0.60, SILVER_COST = 0.03;
export const GATE_TOL = { n: 0.02, netR: 0.01 };
export const FAMILY = ['holdout-vb-early', 'holdout-pullback-deep', 'holdout-phase-pick', 'holdout-h1-veto', 'holdout-weekly-fade'];
const DAY = 86400;
const inW = (day, a, b) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(7) : null);

export function pinCheck() {
  return Object.entries(PINS).map(([f, h]) => {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(EDGE, f))).digest('hex').slice(0, 16);
    return { file: f, want: h, got, ok: got === h };
  });
}

// cost a round trip in price units: the larger of the toolkit's and the market's own breakout study's (pre-registered)
export function studyCost(mk, entry) {
  if (mk === 'xau') return GOLD_COST;
  if (mk === 'xag') return SILVER_COST;
  return fxCostPx(mk, entry);
}
export function costOf(mk, entry) { return Math.max(K.COSTS[mk], studyCost(mk, entry)); }

// the exit time the base rule's walk gives (a stop inside a candle: that candle's close time; else 21:00 UTC)
export function exitTime(bars, x) {
  const i = bars.findIndex((b) => b.t === x.fillT), s = x.side, b0 = bars[i];
  if (s > 0 ? b0.l <= x.stop : b0.h >= x.stop) return b0.t + 300;
  for (let j = i + 1; j < bars.length; j++) {
    const b = bars[j];
    if (s * (b.o - x.stop) <= 0 || (s > 0 ? b.l <= x.stop : b.h >= x.stop)) return b.t + 300;
  }
  return bars.at(-1).t + 300;
}

// one day: the base rule's trade, marked early (fill candle starts before 06:00 UTC) or late. Cancelling both orders at
// 06:00 is the same as keeping the base trade only when its FIRST fill is early (the first fill wins in the base rule).
export function dayTrade(mk, d) {
  if (daySkip(d)) return null;
  const x = vbTrade(d.bars, { k: KV, sides: 'both', prevRange: d.prevRange, cost: 0 });
  if (x.skip) return null;
  const c = costOf(mk, x.entry), cs = studyCost(mk, x.entry), fin = x.finR || 0;
  return { mk, day: x.day || d.day, d0: d.d0, side: x.side, fillT: x.fillT, fillMin: x.fillMin, early: x.fillT - d.d0 < CUT_S,
    open: x.open, entry: x.entry, stop: x.stop, exit: x.exit, how: x.how, exitT: exitTime(d.bars, x), r: x.r, R: x.R,
    net: x.R - c / x.r - fin, net2: x.R - 2 * c / x.r - 2 * fin, netStudy: x.R - cs / x.r - fin };
}

// month sums over a fixed span (empty months 0), YYYY-MM inclusive
export function monthSeries(trades, fromM, toM, key = 'net') {
  const m = new Map(); for (const x of trades) { const k = new Date(x.exitT * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const out = []; let [y, mo] = fromM.split('-').map(Number); const [y1, m1] = toM.split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { const k = `${y}-${String(mo).padStart(2, '0')}`; out.push(m.get(k) || 0); mo === 12 ? (y++, (mo = 1)) : mo++; }
  return out;
}
export function tOf(v) { const s = sdv(v); return v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null; }
export function pOne(t, df) { if (t == null) return 1; const p2 = K.pFromT(t, df); return t > 0 ? p2 / 2 : 1 - p2 / 2; }
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: r3(d), t: se > 0 ? r2(d / se) : null };
}
export function summ(tr, months) {
  const net = tr.map((x) => x.net);
  const mt = months ? tOf(months.net) : null, t2 = months ? tOf(months.net2) : null, tg = months ? tOf(months.R) : null;
  let eq = 0, pk = 0, dd = 0; for (const v of [...tr].sort((a, b) => a.fillT - b.fillT).map((x) => x.net)) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), total: r2(net.reduce((s, v) => s + v, 0)), months: months ? months.net.length : null, t: r2(mt), tRaw: mt,
    t2x: r2(t2), grossT: r2(tg), maxDD: r2(dd), stops: tr.filter((x) => x.how === 'stop').length, time: tr.filter((x) => x.how === 'time').length,
    buys: side(1), sells: side(-1) };
}
const spanOf = (set, lastDay) => [SETS[set].from.slice(0, 7), (SETS[set].to < lastDay ? SETS[set].to : lastDay).slice(0, 7)];
export function monthsFor(tr, span) { return { net: monthSeries(tr, ...span, 'net'), net2: monthSeries(tr, ...span, 'net2'), R: monthSeries(tr, ...span, 'R') }; }
export function byYear(tr) {
  const o = {}; for (const x of tr) { const y = x.day.slice(0, 4); (o[y] ||= { n: 0, t: 0 }); o[y].n++; o[y].t += x.net; }
  for (const y in o) o[y] = { n: o[y].n, netR: r3(o[y].t / o[y].n), total: r2(o[y].t) };
  return o;
}

// harness gate: the unfiltered base rule at each study's own cost on the holdout years its published result covers
export function published() {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(EDGE, f, 'result.json')));
  const fxm = J('fx-majors-vb-early'), uj = J('usdjpy-vol-breakout-early'), yc = J('yen-crosses-vol-breakout'), sv = J('silver-vol-breakout'), gr = J('gold-vol-breakout-replicate');
  const pick = (src, by, y0, y1, w) => { const ys = Object.entries(by).filter(([y]) => y >= y0 && y <= y1); const n = ys.reduce((a, [, b]) => a + b.n, 0), tot = ys.reduce((a, [, b]) => a + b.total, 0);
    return { src, w: w || [`${y0}-01-01`, `${y1}-12-31`], n, netR: r3(tot / n), years: ys.map(([y]) => y) }; };
  return {
    xau: [pick('gold-vol-breakout-replicate', gr.main.byYear, '2007', '2009')],
    eurusd: [pick('fx-majors-vb-early', fxm.series.eurusd.all.byYear, '2005', '2009', ['2005-01-04', '2009-12-31'])],
    gbpusd: [pick('fx-majors-vb-early', fxm.series.gbpusd.all.byYear, '2005', '2009', ['2005-01-04', '2009-12-31'])],
    audusd: [pick('fx-majors-vb-early', fxm.series.audusd.all.byYear, '2005', '2009', ['2005-01-04', '2009-12-31'])],
    usdjpy: [pick('usdjpy-vol-breakout-early', uj.decision.all.byYear, '2005', '2009', ['2005-01-04', '2009-12-31'])],
    usdcad: [pick('fx-majors-vb-early', fxm.series.usdcad.all.byYear, '2010', '2015')],
    usdchf: [pick('fx-majors-vb-early', fxm.series.usdchf.all.byYear, '2010', '2015')],
    eurjpy: [pick('yen-crosses-vol-breakout (complete years)', yc.series.eurjpy.all.byYear, '2010', '2025')],
    xag: [pick('silver-vol-breakout (complete years)', sv.tests.ALL.byYear, '2016', '2025')],
    nzdusd: [],
  };
}
export function gate(mk, all, pub) {
  return pub.map((p) => {
    const a = all.filter((x) => inW(x.day, ...p.w)), n = a.length, netR = mean(a.map((x) => x.netStudy));
    return { market: mk, ...p, got: { n, netR: r3(netR) }, ok: Math.abs(n - p.n) <= GATE_TOL.n * p.n && Math.abs(netR - p.netR) <= GATE_TOL.netR };
  });
}

// the D1 / H4 phase known at the day's 00:00 UTC (a tag; nothing judged on it)
export function phaseTags(m5, days) {
  const tf = { '1d': K.dailyNY(m5), '4h': K.resample(m5, 14400), '1h': K.resample(m5, 3600), '15m': [], '5m': [] };
  const out = new Map();
  for (const d of days) {
    try { const P = readPhase(tf, d.d0, { window: 300 }); out.set(d.day, { d1: P.tf['1d'].side * 1 + ':' + P.tf['1d'].stage, h4: P.tf['4h'].side * 1 + ':' + P.tf['4h'].stage }); }
    catch { out.set(d.day, null); }
  }
  return out;
}

export function family(myP) {
  const ps = FAMILY.map((s) => {
    if (s === 'holdout-vb-early') return myP;
    try { const r = JSON.parse(fs.readFileSync(path.join(EDGE, s, 'result.json'))); return r.primary?.p ?? r.primaryP ?? null; } catch { return null; }
  });
  const known = ps.every((p) => p != null);
  const adj = known ? K.holm(ps)[0] : Math.min(1, FAMILY.length * myP);   // until all five are in: Holm's largest multiplier (an upper bound)
  return { studies: FAMILY, p: ps.map(r6), complete: known, pHolm: r6(adj), note: known ? 'Holm over the five primary p values' : 'not every sibling result is in yet: the bound 5 x p (Holm\'s largest multiplier) is used; the adjusted p can only be this or smaller' };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const yn = (b) => (b ? 'yes' : 'no');
export function report(R) {
  const P = R.primary, L = [`# The volatility breakout, early fills only, on the untouched holdout (holdout-vb-early, 23 Nov 2026)`, '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.', '',
    'Said plainly, as the pre-registration says: the pooled breakout (every fill hour) was already read on most holdout markets by earlier studies; only the split by fill hour is untouched. NZD/USD has never been in a breakout study.', '',
    '## The bar', '',
    '| Line | Needed | Here | Met |', '|---|---|---|---|',
    `| 1 | Set A mean R after costs > 0 | ${sg(R.sets.A.early.netR)} (n ${R.sets.A.early.n}) | ${yn(R.checks.setA)} |`,
    `| 2 | Set B mean R after costs > 0 | ${sg(R.sets.B.early.netR)} (n ${R.sets.B.early.n}) | ${yn(R.checks.setB)} |`,
    `| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t ${sg(P.t, 2)} (${P.months} months), one-sided p ${P.p}, Holm ≤ ${r3(R.family.pHolm)} | ${yn(R.checks.t2 && R.checks.holm)} |`,
    `| 4 | ≥ 100 pooled trades | ${P.n} | ${yn(R.checks.n100)} |`,
    `| 5 | pooled mean R > 0 at 2x costs | ${sg(P.net2R)} | ${yn(R.checks.cost2x)} |`,
    `| gate | harness reproduces published results | ${R.gate.filter((g) => g.ok).length} of ${R.gate.length} windows | ${yn(R.gateOk)} |`, '',
    `Family: ${R.family.note}.`, '',
    '## Early fills (the rule) against late fills (06:00-21:00 UTC), after costs', '',
    '| Series | Early n | Early net R | Early gross R | Early 2x cost | Early month t | Late n | Late net R | Early − late (Welch t) |', '|---|---|---|---|---|---|---|---|---|'];
  const row = (name, S) => L.push(`| ${name} | ${S.early.n} | ${sg(S.early.netR)} | ${sg(S.early.grossR)} | ${sg(S.early.net2R)} | ${sg(S.early.t, 2)} | ${S.late.n} | ${sg(S.late.netR)} | ${sg(S.earlyMinusLate.diff)} (${sg(S.earlyMinusLate.t, 2)}) |`);
  row('**Pooled holdout**', R.pooled); row('Set A', R.sets.A); row('Set B', R.sets.B);
  for (const [k, S] of Object.entries(R.markets)) row(`${k} (${S.set})`, S);
  L.push('', '## In plain words', '', R.reading, '',
    '## Sides and exits (pooled early fills)', '',
    `Buys n ${P.buys.n} ${sg(P.buys.netR)}R, sells n ${P.sells.n} ${sg(P.sells.netR)}R; stopped ${P.stops}, out at 21:00 ${P.time}; worst drawdown ${sg(P.maxDD, 2)}R. Unfiltered base rule on the same days: n ${R.unfiltered.n}, ${sg(R.unfiltered.netR)}R a trade.`, '',
    '## By year (early fills, net R a trade, n)', '', '| Year | Set A | Set B |', '|---|---|---|');
  const ys = [...new Set([...Object.keys(R.sets.A.byYear), ...Object.keys(R.sets.B.byYear)])].sort();
  for (const y of ys) { const a = R.sets.A.byYear[y], b = R.sets.B.byYear[y]; L.push(`| ${y} | ${a ? `${sg(a.netR)} (${a.n})` : '—'} | ${b ? `${sg(b.netR)} (${b.n})` : '—'} |`); }
  L.push('', '## Harness gate (unfiltered base rule at each study\'s own cost)', '', '| Market | Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |', '|---|---|---|---|---|---|');
  for (const g of R.gate) L.push(`| ${g.market} | ${g.src} | ${g.w[0]} → ${g.w[1]} | ${g.n} / ${sg(g.netR)} | ${g.got.n} / ${sg(g.got.netR)} | ${yn(g.ok)} |`);
  L.push('', 'NZD/USD has no published breakout result, so no gate applies to it.', '',
    '## What this does NOT show', '',
    '- It tests one cut (06:00 UTC) fixed before the run; no other hour is tried, and choosing one now on these trades would be a search.',
    '- Set B costs are ASSUMED, not measured on the demo account; past years are charged today\'s costs; OANDA mid candles, not broker ticks.',
    '- The phase tags in `trades.json` (D1 / H4 side and stage known at 00:00 UTC) are a description, never part of the verdict.',
    '- Whatever the verdict, nothing here is an edge on its own and nothing live changes.', '',
    '## Audit correction (23 Nov 2026)', '',
    '- An adversarial audit re-checked look-ahead (the trade reads only the previous day\'s range and candles after the open; the phase tags read only candles closed by 00:00 UTC), costs, fills, the holdout windows (no 2010-2026 candle of the five main markets is loaded), the pins and the numbers (recomputed from `trades.json`). No defect changes a number or the verdict.',
    '- Wording fixed: the plain-words paragraph said early fills beat late ones on Set B "only by losing less"; Set B early fills are +0.012R a trade (not a loss) and late fills −0.046R.',
    '- Said plainly: the base rule\'s `daySkip` drops a day with fewer than 200 M5 candles by 21:00 UTC, which is known only after the day. It is the pinned base rule (a data-quality filter, unchanged on purpose). Holdout days it drops that had an early fill: 7 (+3.13R after costs in all); with them the pooled result moves by under 0.001R a trade and no line changes.', '',
    '## Data and method', '', `- ${R.data}`, `- ${R.method}`, '- To repeat: `node research/edge/holdout-vb-early/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).', '');
  return L.join('\n');
}

function seriesOf(early, late, months) {
  return { early: summ(early, months), late: summ(late), earlyMinusLate: welch(early.map((x) => x.net), late.map((x) => x.net)), byYear: byYear(early) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pins = pinCheck(), pub = published(), all = [], gates = [], data = [], tagsBy = new Map(); let lastDay = '';
  for (const set of ['A', 'B']) {
    const S = SETS[set];
    for (const mk of S.markets) {
      const m5 = K.load(mk, '5m', S.load);
      const rows = m5.map((b) => [b.t, b.o, b.h, b.l, b.c]);
      const fileLast = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
      const days = buildDays(rows).filter((d) => d.day < fileLast || set === 'A');   // Set B: the last day on file may be incomplete
      const inSet = days.filter((d) => inW(d.day, S.from, S.to));
      const tags = phaseTags(m5, inSet);
      const tr = inSet.map((d) => dayTrade(mk, d)).filter(Boolean).map((x) => ({ ...x, set, phase: tags.get(x.day) }));
      all.push(...tr); gates.push(...gate(mk, tr, pub[mk] || []));
      const ld = inSet.at(-1)?.day || ''; if (set === 'B' && ld > lastDay) lastDay = ld;
      data.push(`${mk} (Set ${set}): ${m5.length} M5 candles ${new Date(m5[0].t * 1000).toISOString().slice(0, 10)} → ${new Date(m5.at(-1).t * 1000).toISOString().slice(0, 10)}, ${inSet.length} weekdays in the set, ${tr.length} base trades`);
    }
  }
  all.sort((a, b) => a.fillT - b.fillT);
  const E = (f) => all.filter((x) => x.early && f(x)), Lt = (f) => all.filter((x) => !x.early && f(x));
  const spA = spanOf('A', lastDay), spB = spanOf('B', lastDay);
  const mA = monthsFor(E((x) => x.set === 'A'), spA), mB = monthsFor(E((x) => x.set === 'B'), spB);
  const mP = { net: [...mA.net, ...mB.net], net2: [...mA.net2, ...mB.net2], R: [...mA.R, ...mB.R] };
  const pooled = seriesOf(E(() => true), Lt(() => true), mP);
  const sets = { A: seriesOf(E((x) => x.set === 'A'), Lt((x) => x.set === 'A'), mA), B: seriesOf(E((x) => x.set === 'B'), Lt((x) => x.set === 'B'), mB) };
  const markets = {};
  for (const set of ['A', 'B']) for (const mk of SETS[set].markets) {
    const sp = set === 'A' ? spA : spB, e = E((x) => x.mk === mk);
    markets[mk] = { set, ...seriesOf(e, Lt((x) => x.mk === mk), monthsFor(e, sp)) };
  }
  const P = pooled.early, p = pOne(P.tRaw, P.months - 1), fam = family(p);
  const checks = { setA: sets.A.early.netR > 0, setB: sets.B.early.netR > 0, t2: P.tRaw >= 2, holm: fam.pHolm < 0.05, n100: P.n >= 100, cost2x: P.net2R > 0 };
  const gateOk = gates.every((g) => g.ok), pinsOk = pins.every((x) => x.ok);
  const word = !pinsOk || !gateOk || P.n < 100 ? 'INCONCLUSIVE' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const missed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const nz = markets.nzdusd.early;
  const verdict = `${word}${!pinsOk ? ' (pinned module changed)' : ''}${!gateOk ? ' (harness gate missed)' : ''}: pooled holdout early fills ${sg(P.netR)}R a trade after costs (n ${P.n}, month t ${sg(P.t, 2)}, one-sided p ${r3(p)}); Set A ${sg(sets.A.early.netR)}R (n ${sets.A.early.n}), Set B ${sg(sets.B.early.netR)}R (n ${sets.B.early.n}); 2x costs ${sg(P.net2R)}R${missed.length ? '; lines missed: ' + missed.join(', ') : ''}`;
  const U = summ(all);
  const reading = `${word === 'PASS' ? 'Every pre-registered line holds. Paper research only: at most a candidate for its own forward paper record, by the owner\'s decision.' : `The rule does not pass the pre-registered bar (${word}${missed.length ? '; missed: ' + missed.join(', ') : ''}).`} ` +
    `Early fills, pooled: ${sg(P.netR)}R a trade after costs (n ${P.n}, gross ${sg(P.grossR)}R, month t ${sg(P.t, 2)} over ${P.months} months). Late fills of the same rule: ${sg(pooled.late.netR)}R (n ${pooled.late.n}); early minus late ${sg(pooled.earlyMinusLate.diff)}R (Welch t ${sg(pooled.earlyMinusLate.t, 2)}). ` +
    `NZD/USD, the cleanest slice (never in a breakout study, no verdict): early ${sg(nz.netR)}R (n ${nz.n}, month t ${sg(nz.t, 2)}), late ${sg(markets.nzdusd.late.netR)}R (n ${markets.nzdusd.late.n}). ` +
    `Gold 2006-09 early ${sg(markets.xau.early.netR)}R (n ${markets.xau.early.n}); USD/JPY 2005-09 early ${sg(markets.usdjpy.early.netR)}R (n ${markets.usdjpy.early.n}). ` +
    (checks.cost2x ? '' : 'Line 5 (2x costs) is missed whatever the four sibling studies report, so the FAIL does not wait on the family\'s Holm. ') +
    `Set A (2005-09) is strong (${sg(sets.A.early.netR)}R, month t ${sg(sets.A.early.t, 2)}) and Set B (fresh markets, 2010 on) is flat (${sg(sets.B.early.netR)}R, t ${sg(sets.B.early.t, 2)}): the early-fill lean held in the early years of the markets it was found on, not on markets it was never seen on. Early fills beat late fills on both sets (Welch t ${sg(sets.A.earlyMinusLate.t, 2)} and ${sg(sets.B.earlyMinusLate.t, 2)}), on Set B early fills are about flat and late fills lose. ` +
    'The split was chosen from in-sample trades of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'holdout-vb-early', built: '2026-11-23', preregistration: 'research/edge/holdout-vb-early/PREREGISTRATION.md', planSha256: sha, verdict, verdictWord: word,
    primary: { p: r6(p), t: P.t, n: P.n, months: P.months }, checks, family: fam, pins, pinsOk, gate: gates, gateOk, lastDay,
    data: data.join('; ') + '. Source: the shared toolkit\'s OANDA mid M5 cache; 2010-2026 on the five main markets not read.',
    method: 'Base rule imported unchanged (gold-vol-breakout buildDays / daySkip / vbTrade, k 0.5, both sides, stop at the UTC open, out at the 20:55 candle close). Early = the first fill\'s candle starts before 06:00 UTC (both orders cancelled at 06:00 otherwise). Cost a round trip: max(toolkit COSTS, the market\'s own study cost: gold $0.60, silver $0.03, forex 0.000045 x entry + 0.5 pip); 2x reported. Month sums by exit month over each set\'s span (empty months 0), Set A and Set B months pooled; p one-sided from the toolkit\'s t. Gate: the unfiltered rule at each study\'s own cost against its published by-year results on the overlapping holdout years.',
    sets: { A: { ...SETS.A, span: spA, ...sets.A }, B: { ...SETS.B, span: spB, ...sets.B } }, pooled, primaryStats: P, markets, unfiltered: { n: U.n, netR: U.netR, grossR: U.grossR }, reading };
  R.primary = { ...R.primary }; R.pooled = pooled; R.primaryStats = P;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report({ ...R, primary: { ...P, p: r3(p) } }) + '\n');
  const slim = all.map((x) => [x.set, x.mk, x.day, x.side, x.fillT, r6(x.entry), r6(x.stop), r6(x.exit), x.exitT, x.how, x.early ? 1 : 0, r3(x.R), r3(x.net), r3(x.net2), x.phase ? x.phase.d1 : null, x.phase ? x.phase.h4 : null]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols: ['set', 'market', 'day', 'side', 'fillT', 'entry', 'stop', 'exit', 'exitT', 'how', 'early', 'R', 'Rnet', 'Rnet2x', 'phaseD1', 'phaseH4'], rows: slim }) + '\n');
  console.log(verdict);
  console.log(JSON.stringify(gates.map((g) => [g.market, g.n, g.got.n, g.netR, g.got.netR, g.ok])));
}
