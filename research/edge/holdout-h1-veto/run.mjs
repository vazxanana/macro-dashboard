// Edge research · holdout-h1-veto: the volatility breakout (gold-vol-breakout vbTrade, k 0.5, both sides, stop at the
// day's open, out at 21:00 UTC), all fill hours, with ONE veto: no trade on a day whose first fill goes against a fresh H1
// break (the last H1 break, BO or ChoCh, of toolkit structure(resample(m5, 3600), 3) against the fill side, its candle among
// the last 6 H1 candles closed at the fill). Judged on the untouched holdout (PREREGISTRATION.md, committed alone first).
// Paper research only: nothing live reads or changes.
//   node research/edge/holdout-h1-veto/run.mjs        (reads the shared toolkit's candle cache, EDGE_DATA, out of git)
// Base rule imported unchanged: gold-vol-breakout/run.mjs (buildDays), fx-vol-breakout/run.mjs (costPx), both pinned by
// sha256 below; the per-day trade, costs, gate and summaries are holdout-vb-early's own functions (the same base part).
// The phase reader (research/edge/_lib/phase.mjs, through holdout-vb-early phaseTags) tags each trade with the D1 / H4
// reading known at the day's 00:00 UTC: a description, never part of the verdict.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildDays } from '../gold-vol-breakout/run.mjs';
import * as V from '../holdout-vb-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDGE = path.join(HERE, '..');
export const PINS = V.PINS;
export const SETS = V.SETS;
export const H1 = 3600, SWING_K = 3, FRESH = 6;
export const FAMILY = V.FAMILY;
const inW = (day, a, b) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(7) : null);

export const pinCheck = V.pinCheck;

// H1 candles and their structure events over the whole loaded history (warm-up included)
export function h1Structure(m5) {
  const h1 = K.resample(m5, H1);
  return { h1, events: K.structure(h1, SWING_K).events };
}

// The veto at the first fill (fillT = start of the M5 candle the stop order filled in). Only H1 candles closed at or before
// fillT are read (e <= fillT). age = how many of those closed H1 candles, counted back from the last one, reach the break's
// candle (1 = the break candle is the last H1 candle closed at the fill). Veto when the break is against the side and age <= 6.
export function vetoAt({ h1, events }, fillT, side) {
  const n = K.closedCount(h1, fillT);
  let lo = 0, hi = events.length;                      // last event with candle index < n
  while (lo < hi) { const m = (lo + hi) >> 1; if (events[m].i < n) lo = m + 1; else hi = m; }
  const ev = lo > 0 ? events[lo - 1] : null;
  if (!ev) return { veto: false, age: null, dir: 0, kind: null };
  const age = n - ev.i;
  return { veto: ev.dir === -side && age <= FRESH, age, dir: ev.dir, kind: ev.kind, breakT: ev.t };
}

export function family(myP) {
  const ps = FAMILY.map((s) => {
    if (s === 'holdout-h1-veto') return myP;
    try { const r = JSON.parse(fs.readFileSync(path.join(EDGE, s, 'result.json'))); return r.primary?.p ?? r.primaryP ?? null; } catch { return null; }
  });
  const known = ps.every((p) => p != null);
  const i = FAMILY.indexOf('holdout-h1-veto');
  const adj = known ? K.holm(ps)[i] : Math.min(1, FAMILY.length * myP);
  return { studies: FAMILY, p: ps.map(r6), complete: known, pHolm: r6(adj),
    note: known ? 'Holm over the five primary p values' : 'not every sibling result is in yet: the bound 5 x p (Holm\'s largest multiplier) is used; the adjusted p can only be this or smaller' };
}

const spanOf = (set, lastDay) => [SETS[set].from.slice(0, 7), (SETS[set].to < lastDay ? SETS[set].to : lastDay).slice(0, 7)];
function seriesOf(kept, vetoed, months) {
  return { kept: V.summ(kept, months), vetoed: V.summ(vetoed), keptMinusVetoed: V.welch(kept.map((x) => x.net), vetoed.map((x) => x.net)), byYear: V.byYear(kept) };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const yn = (b) => (b ? 'yes' : 'no');
export function report(R) {
  const P = R.primaryStats, L = [`# The volatility breakout with an H1-break veto, on the untouched holdout (holdout-h1-veto, 23 Nov 2026)`, '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.', '',
    'Said plainly: the pooled breakout (the base rule, every fill hour) was already read on most holdout markets by earlier studies; only the split by the H1 structure at the fill is untouched. NZD/USD has never been in a breakout study.', '',
    '## The bar', '',
    '| Line | Needed | Here | Met |', '|---|---|---|---|',
    `| 1 | Set A mean R after costs > 0 | ${sg(R.sets.A.kept.netR)} (n ${R.sets.A.kept.n}) | ${yn(R.checks.setA)} |`,
    `| 2 | Set B mean R after costs > 0 | ${sg(R.sets.B.kept.netR)} (n ${R.sets.B.kept.n}) | ${yn(R.checks.setB)} |`,
    `| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t ${sg(P.t, 2)} (${P.months} months), one-sided p ${r3(R.primary.p)}, Holm ${R.family.complete ? '' : '≤ '}${r3(R.family.pHolm)} | ${yn(R.checks.t2 && R.checks.holm)} |`,
    `| 4 | ≥ 100 pooled trades | ${P.n} | ${yn(R.checks.n100)} |`,
    `| 5 | pooled mean R > 0 at 2x costs | ${sg(P.net2R)} | ${yn(R.checks.cost2x)} |`,
    `| gate | harness reproduces published results | ${R.gate.filter((g) => g.ok).length} of ${R.gate.length} windows | ${yn(R.gateOk)} |`, '',
    `Family: ${R.family.note}.`, '',
    '## Kept days (the rule) against vetoed days, after costs', '',
    '| Series | Kept n | Kept net R | Kept gross R | Kept 2x cost | Kept month t | Vetoed n | Vetoed net R | Kept − vetoed (Welch t) |', '|---|---|---|---|---|---|---|---|---|'];
  const row = (name, S) => L.push(`| ${name} | ${S.kept.n} | ${sg(S.kept.netR)} | ${sg(S.kept.grossR)} | ${sg(S.kept.net2R)} | ${sg(S.kept.t, 2)} | ${S.vetoed.n} | ${sg(S.vetoed.netR)} | ${sg(S.keptMinusVetoed.diff)} (${sg(S.keptMinusVetoed.t, 2)}) |`);
  row('**Pooled holdout**', R.pooled); row('Set A', R.sets.A); row('Set B', R.sets.B);
  for (const [k, S] of Object.entries(R.markets)) row(`${k} (${S.set})`, S);
  L.push('', '## In plain words', '', R.reading, '',
    '## Sides and exits (pooled kept days)', '',
    `Buys n ${P.buys.n} ${sg(P.buys.netR)}R, sells n ${P.sells.n} ${sg(P.sells.netR)}R; stopped ${P.stops}, out at 21:00 ${P.time}; worst drawdown ${sg(P.maxDD, 2)}R. Base rule without the veto on the same days: n ${R.unfiltered.n}, ${sg(R.unfiltered.netR)}R a trade (month t ${sg(R.unfiltered.t, 2)}). Share of base days vetoed: ${(100 * R.vetoShare).toFixed(1)} %.`, '',
    '## By year (kept days, net R a trade, n)', '', '| Year | Set A | Set B |', '|---|---|---|');
  const ys = [...new Set([...Object.keys(R.sets.A.byYear), ...Object.keys(R.sets.B.byYear)])].sort();
  for (const y of ys) { const a = R.sets.A.byYear[y], b = R.sets.B.byYear[y]; L.push(`| ${y} | ${a ? `${sg(a.netR)} (${a.n})` : '—'} | ${b ? `${sg(b.netR)} (${b.n})` : '—'} |`); }
  L.push('', '## Harness gate (unfiltered base rule at each study\'s own cost)', '', '| Market | Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |', '|---|---|---|---|---|---|');
  for (const g of R.gate) L.push(`| ${g.market} | ${g.src} | ${g.w[0]} → ${g.w[1]} | ${g.n} / ${sg(g.netR)} | ${g.got.n} / ${sg(g.got.netR)} | ${yn(g.ok)} |`);
  L.push('', 'NZD/USD has no published breakout result, so no gate applies to it.', '',
    '## What this does NOT show', '',
    '- One veto, fixed before the run (3-a-side H1 swings, 6 H1 candles); no other swing size, freshness window or timeframe is tried, and choosing one now on these trades would be a search.',
    `- "6 or fewer closed H1 candles" is read as: the break's candle is one of the last ${FRESH} H1 candles closed at the fill candle's start (age 1 = the last closed one). Written in code before the run; the pre-registration does not say whether the break candle itself counts.`,
    '- Set B costs are ASSUMED, not measured on the demo account; past years are charged today\'s costs; OANDA mid candles, not broker ticks.',
    '- The phase tags in `trades.json` (D1 / H4 side and stage known at 00:00 UTC) are a description, never part of the verdict.',
    '- Whatever the verdict, nothing here is an edge on its own and nothing live changes.', '',
    '## Data and method', '', `- ${R.data}`, `- ${R.method}`, '- To repeat: `node research/edge/holdout-h1-veto/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pins = pinCheck(), pub = V.published(), all = [], gates = [], data = []; let lastDay = '';
  for (const set of ['A', 'B']) {
    const S = SETS[set];
    for (const mk of S.markets) {
      const m5 = K.load(mk, '5m', S.load);
      const rows = m5.map((b) => [b.t, b.o, b.h, b.l, b.c]);
      const fileLast = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
      const days = buildDays(rows).filter((d) => d.day < fileLast || set === 'A');
      const inSet = days.filter((d) => inW(d.day, S.from, S.to));
      const HS = h1Structure(m5);
      const tags = V.phaseTags(m5, inSet);
      const tr = inSet.map((d) => V.dayTrade(mk, d)).filter(Boolean).map((x) => { const v = vetoAt(HS, x.fillT, x.side); return { ...x, set, veto: v.veto, age: v.age, h1dir: v.dir, phase: tags.get(x.day) }; });
      all.push(...tr); gates.push(...V.gate(mk, tr, pub[mk] || []));
      const ld = inSet.at(-1)?.day || ''; if (set === 'B' && ld > lastDay) lastDay = ld;
      data.push(`${mk} (Set ${set}): ${m5.length} M5 candles ${new Date(m5[0].t * 1000).toISOString().slice(0, 10)} → ${new Date(m5.at(-1).t * 1000).toISOString().slice(0, 10)}, ${inSet.length} weekdays, ${tr.length} base trades, ${tr.filter((x) => x.veto).length} vetoed`);
      console.error(data.at(-1));
    }
  }
  all.sort((a, b) => a.fillT - b.fillT);
  const Kp = (f) => all.filter((x) => !x.veto && f(x)), Vt = (f) => all.filter((x) => x.veto && f(x));
  const spA = spanOf('A', lastDay), spB = spanOf('B', lastDay);
  const mA = V.monthsFor(Kp((x) => x.set === 'A'), spA), mB = V.monthsFor(Kp((x) => x.set === 'B'), spB);
  const mP = { net: [...mA.net, ...mB.net], net2: [...mA.net2, ...mB.net2], R: [...mA.R, ...mB.R] };
  const pooled = seriesOf(Kp(() => true), Vt(() => true), mP);
  const sets = { A: seriesOf(Kp((x) => x.set === 'A'), Vt((x) => x.set === 'A'), mA), B: seriesOf(Kp((x) => x.set === 'B'), Vt((x) => x.set === 'B'), mB) };
  const markets = {};
  for (const set of ['A', 'B']) for (const mk of SETS[set].markets) {
    const sp = set === 'A' ? spA : spB, e = Kp((x) => x.mk === mk);
    markets[mk] = { set, ...seriesOf(e, Vt((x) => x.mk === mk), V.monthsFor(e, sp)) };
  }
  const uA = V.monthsFor(all.filter((x) => x.set === 'A'), spA), uB = V.monthsFor(all.filter((x) => x.set === 'B'), spB);
  const U = V.summ(all, { net: [...uA.net, ...uB.net], net2: [...uA.net2, ...uB.net2], R: [...uA.R, ...uB.R] });
  const P = pooled.kept, p = V.pOne(P.tRaw, P.months - 1), fam = family(p);
  const checks = { setA: sets.A.kept.netR > 0, setB: sets.B.kept.netR > 0, t2: P.tRaw >= 2, holm: fam.pHolm < 0.05, n100: P.n >= 100, cost2x: P.net2R > 0 };
  const gateOk = gates.every((g) => g.ok), pinsOk = pins.every((x) => x.ok);
  const word = !pinsOk || !gateOk || P.n < 100 ? 'INCONCLUSIVE' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const missed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const vShare = all.filter((x) => x.veto).length / all.length;
  const verdict = `${word}${!pinsOk ? ' (pinned module changed)' : ''}${!gateOk ? ' (harness gate missed)' : ''}: pooled holdout kept days ${sg(P.netR)}R a trade after costs (n ${P.n}, month t ${sg(P.t, 2)}, one-sided p ${r3(p)}); Set A ${sg(sets.A.kept.netR)}R (n ${sets.A.kept.n}), Set B ${sg(sets.B.kept.netR)}R (n ${sets.B.kept.n}); 2x costs ${sg(P.net2R)}R; vetoed days ${sg(pooled.vetoed.netR)}R (n ${pooled.vetoed.n})${missed.length ? '; lines missed: ' + missed.join(', ') : ''}`;
  const KV = pooled.keptMinusVetoed;
  const reading = `${word === 'PASS' ? 'Every pre-registered line holds. Paper research only: at most a candidate for its own forward paper record, by the owner\'s decision.' : `The rule does not pass the pre-registered bar (${word}${missed.length ? '; missed: ' + missed.join(', ') : ''}).`} ` +
    `With the veto, pooled: ${sg(P.netR)}R a trade after costs (n ${P.n}, gross ${sg(P.grossR)}R, month t ${sg(P.t, 2)} over ${P.months} months). Without it (the base rule, same days): ${sg(U.netR)}R (n ${U.n}, month t ${sg(U.t, 2)}). ` +
    `The vetoed days (${(100 * vShare).toFixed(1)} % of base days): ${sg(pooled.vetoed.netR)}R (n ${pooled.vetoed.n}); kept minus vetoed ${sg(KV.diff)}R (Welch t ${sg(KV.t, 2)}). ` +
    `Set A kept ${sg(sets.A.kept.netR)}R vs vetoed ${sg(sets.A.vetoed.netR)}R (t ${sg(sets.A.keptMinusVetoed.t, 2)}); Set B kept ${sg(sets.B.kept.netR)}R vs vetoed ${sg(sets.B.vetoed.netR)}R (t ${sg(sets.B.keptMinusVetoed.t, 2)}). ` +
    'The veto was chosen from in-sample trades of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const vbSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(EDGE, 'holdout-vb-early/run.mjs'))).digest('hex').slice(0, 16);
  const R = { study: 'holdout-h1-veto', built: '2026-11-23', preregistration: 'research/edge/holdout-h1-veto/PREREGISTRATION.md', planSha256: sha, verdict, verdictWord: word,
    primary: { p: r6(p), t: P.t, n: P.n, months: P.months }, checks, family: fam, pins, pinsOk, helper: { 'holdout-vb-early/run.mjs': vbSha }, gate: gates, gateOk, lastDay,
    vetoRule: { swingK: SWING_K, fresh: FRESH, age: 'closed H1 candles at the fill candle start, counted back from the last one to the break candle (1 = the last closed)' },
    vetoShare: r3(vShare),
    data: data.join('; ') + '. Source: the shared toolkit\'s OANDA mid M5 cache; 2010-2026 on the five main markets not read.',
    method: 'Base rule imported unchanged (gold-vol-breakout buildDays / daySkip / vbTrade, k 0.5, both sides, stop at the UTC open, out at the 20:55 candle close), all fill hours; per-day trade and costs = holdout-vb-early dayTrade / costOf (max(toolkit COSTS, the market\'s own study cost: gold $0.60, silver $0.03, forex 0.000045 x entry + 0.5 pip)); 2x reported. Veto: H1 = toolkit resample(m5, 3600) over the continuous loaded history (warm-up included), structure(H1, 3) events (BO and ChoCh); at the first fill, the last event whose candle closed at or before the fill candle\'s start; vetoed when its direction is against the fill side and its age (above) <= 6; the day then has no trade (the other order is cancelled). Month sums by exit month over each set\'s span (empty months 0), Set A and Set B months pooled; p one-sided from the toolkit\'s t. Gate: the unfiltered rule at each study\'s own cost against its published by-year results on the overlapping holdout years.',
    sets: { A: { ...SETS.A, span: spA, ...sets.A }, B: { ...SETS.B, span: spB, ...sets.B } }, pooled, primaryStats: P, markets, unfiltered: { n: U.n, netR: U.netR, grossR: U.grossR, t: U.t }, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  const slim = all.map((x) => [x.set, x.mk, x.day, x.side, x.fillT, r6(x.entry), r6(x.stop), r6(x.exit), x.exitT, x.how === 'stop' ? 's' : 't', x.veto ? 1 : 0, x.age, x.h1dir, r3(x.R), r3(x.net), r3(x.net2), x.phase ? x.phase.d1 + '|' + x.phase.h4 : null]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols: ['set', 'market', 'day', 'side', 'fillT', 'entry', 'stop', 'exit', 'exitT', 'how', 'veto', 'h1Age', 'h1Dir', 'R', 'Rnet', 'Rnet2x', 'phaseD1H4'], rows: slim }) + '\n');
  console.log(verdict);
  console.log(JSON.stringify(gates.map((g) => [g.market, g.n, g.got.n, g.netR, g.got.netR, g.ok])));
}
