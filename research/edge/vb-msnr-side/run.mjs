// Edge research · vb-msnr-side: the daily volatility breakout T1 on gold and USD/JPY, split by the key-level direction call
// (H4 working chart, Daily key levels) known before the day opens: WITH the call against AGAINST it (PREREGISTRATION.md,
// committed alone first). Research only: nothing live reads or changes.
//   node research/edge/vb-msnr-side/run.mjs      (reads the shared toolkit's candle cache, EDGE_DATA; no network)
// Imported unchanged: the breakout harnesses and their measured costs, and council/eg-methods.mjs direction().
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { direction } from '../../../council/eg-methods.mjs';
import { dayKey } from '../msnr-entry/run.mjs';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { daysOf, tradesIn } from '../gold-vol-breakout-hourcost/costs.mjs';
import { costFrac, hourOf } from '../gold-vol-breakout-hourcost/run.mjs';
import { buildDays as fxDays } from '../index-vol-breakout/original.mjs';
import { trades as fxTrades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'usdjpy'], SETS = ['xau', 'usdjpy', 'both'], GROUPS = ['WITH', 'AGAINST'];
export const WIN = { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2026-10-31'] };
export const MIN_N = 300, SLIP = 0.05, H4 = 14400, GATE_TOL = { n: 0.02, netR: 0.01 };
export const GATE = {
  xau: [['2007-01-01', '2011-12-31', 929, 0.202], ['2012-01-01', '2015-12-31', 728, 0.170], ['2016-01-01', '2020-12-31', 935, 0.094], ['2021-01-01', '2026-11-12', 1121, 0.105]],
  usdjpy: [['2005-01-04', '2015-12-31', 2089, 0.079], ['2016-01-01', '2026-11-19', 2079, 0.063]],
};
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ---- the direction call ------------------------------------------------------------------------------------------------
// H4 candles (UTC blocks, every block kept) and the call after each one closes
export function calls(m5) {
  const h4 = K.resample(m5, H4);
  const D = direction(h4.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })), dayKey, 86400);
  return { h4, call: D.call, events: D.events.length };
}
// the call known at moment t: after the last H4 candle that closed at or before t (0 when none)
export function callAt(C, t) { const n = K.closedCount(C.h4, t); return n ? C.call[n - 1] : 0; }
export const groupOf = (side, call) => (call === 0 ? 'NONE' : side === call ? 'WITH' : 'AGAINST');
export const d0Of = (day) => Date.parse(day + 'T00:00:00Z') / 1000;

// ---- trades ------------------------------------------------------------------------------------------------------------
// gold: the hourcost study's trades, charged its condition C1 (hour profile + commission + 0.05 x M)
export function goldTrades(rows, prof, commission) {
  const { days, dataEnd } = daysOf(rows);
  const tr = tradesIn(days, ['2005-01-01', '2099-12-31']).tr.map((x) => ({ mk: 'xau', day: x.day, side: x.side, R: x.R,
    net: x.R - x.finR - (costFrac(prof, hourOf(x), 'frac', commission) * x.entry + SLIP * x.M) / x.r }));
  return { tr, dataEnd };
}
// USD/JPY: the early study's trades (fx-vol-breakout's charge: 0.000045 of the entry + 0.5 pip)
export function jpyTrades(rows) {
  const lastDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
  const days = fxDays(rows).filter((d) => d.day < lastDay);
  return { tr: fxTrades('usdjpy', days).map((x) => ({ mk: 'usdjpy', day: x.day, side: x.side, R: x.R, net: x.net })), dataEnd: days.at(-1).day };
}
export function tag(tr, C) { for (const x of tr) { x.call = callAt(C, d0Of(x.day)); x.group = groupOf(x.side, x.call); } return tr; }

// ---- statistics --------------------------------------------------------------------------------------------------------
export function summ(tr) {
  const mt = O.monthT(tr);
  return { n: tr.length, gross: r3(mean(tr.map((x) => x.R))), mean: r3(mean(tr.map((x) => x.net))), t: r2(mt.t), tRaw: mt.t, months: mt.months };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: r3(d), t: se > 0 ? r2(d / se) : null };
}
const pick = (all, set, group, w) => all.filter((x) => (set === 'both' || x.mk === set) && (!group || x.group === group) && inW(x.day, WIN[w]));
export function evaluate(all) {
  const cells = [];
  for (const set of SETS) for (const g of GROUPS) cells.push({ cell: `${set} ${g}`, set, group: g, disc: summ(pick(all, set, g, 'disc')), conf: summ(pick(all, set, g, 'conf')) });
  const ps = cells.map((c) => O.normP(c.conf.tRaw)), adj = O.holm(ps);
  const diffs = {};
  for (const set of SETS) { diffs[set] = {}; for (const w of ['disc', 'conf']) diffs[set][w] = welch(pick(all, set, 'WITH', w).map((x) => x.net), pick(all, set, 'AGAINST', w).map((x) => x.net)); }
  cells.forEach((c, i) => {
    c.p = r3(ps[i]); c.holm = r3(adj[i]);
    c.profit = c.disc.n >= MIN_N && c.conf.n >= MIN_N && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.tRaw >= 2 && c.conf.tRaw >= 2 && adj[i] < 0.05;
    const d = diffs[c.set];
    c.adds = d.disc.diff > 0 && d.conf.diff > 0 && d.disc.t >= 2 && d.conf.t >= 2;
    c.pass = c.group === 'WITH' && c.profit && c.adds;
    delete c.disc.tRaw; delete c.conf.tRaw;
  });
  const extra = {};
  for (const set of SETS) { extra[set] = {};
    for (const w of ['disc', 'conf']) {
      const base = pick(all, set, null, w), none = base.filter((x) => x.group === 'NONE'), o = { all: summ(base), none: summ(none), sides: {}, callDays: {} };
      for (const g of GROUPS) for (const [nm, s] of [['buys', 1], ['sells', -1]]) { const a = base.filter((x) => x.group === g && x.side === s); o.sides[`${g} ${nm}`] = { n: a.length, mean: r3(mean(a.map((x) => x.net))) }; }
      for (const [nm, v] of [['buy', 1], ['sell', -1], ['none', 0]]) o.callDays[nm] = base.filter((x) => x.call === v).length;
      for (const k of ['all', 'none']) delete o[k].tRaw;
      extra[set][w] = o;
    } }
  return { cells, diffs, extra };
}
export function gateOf(mk, tr) {
  return GATE[mk].map(([a, b, n, netR]) => { const x = tr.filter((t) => inW(t.day, [a, b])), got = { n: x.length, netR: r3(mean(x.map((t) => t.net))) };
    return { market: mk, from: a, to: b, want: { n, netR }, got, ok: Math.abs(got.n - n) <= GATE_TOL.n * n && Math.abs(got.netR - netR) <= GATE_TOL.netR + 1e-9 }; });
}
export function verdictOf(cells, gateOk) {
  if (!gateOk) return 'INCONCLUSIVE';
  const W = cells.filter((c) => c.group === 'WITH');
  if (W.some((c) => c.pass)) return 'PASS';
  if (W.every((c) => c.disc.n < MIN_N || c.conf.n < MIN_N)) return 'INCONCLUSIVE';
  return 'FAIL';
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
export function report(R) {
  const L = ['# The breakout, WITH against AGAINST the key-level direction call (vb-msnr-side, 24 Nov 2026)', '',
    `**Verdict: ${R.verdict}. ${R.headline[0].toUpperCase() + R.headline.slice(1)}**`, '',
    'Run as pre-registered (`PREREGISTRATION.md`, committed alone first; its sha256 is in `result.json`). Research only: nothing live',
    'changed, nothing is proposed, the forward records of the two breakouts run on unchanged. One run, no variants. This page is',
    'written by `run.mjs` from `result.json`.', '',
    '## What was run', '',
    'The daily breakout T1 (open of the UTC day plus or minus half the previous day\'s range, stop back at the open, out before',
    '21:00 UTC) on gold and USD/JPY, each at its study\'s measured cost. Each day\'s trade was labelled by the desk\'s direction call',
    '(`council/eg-methods.mjs` `direction()`, H4 working chart, Daily key levels) as it stood after the last H4 candle closed at or',
    'before 00:00 UTC: WITH = the fill is on the call\'s side, AGAINST = on the other side, NONE = no call yet.', '',
    '## The cells (R a trade; month t on calendar-month sums of after-cost R)', '',
    '| Cell | 2005-14 n | before costs | after costs | month t | 2015-26 n | before costs | after costs | month t | Holm p | Profit bar | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of R.cells) L.push(`| ${c.cell} | ${c.disc.n} | ${f3(c.disc.gross)} | ${f3(c.disc.mean)} | ${f2(c.disc.t)} | ${c.conf.n} | ${f3(c.conf.gross)} | ${f3(c.conf.mean)} | ${f2(c.conf.t)} | ${c.holm} | ${c.profit ? 'yes' : 'no'} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Does the call add anything? WITH minus AGAINST, after costs (Welch t on trades)', '', '| Market set | 2005-14 difference | Welch t | 2015-26 difference | Welch t | Both > 0 with t >= 2 |', '|---|---|---|---|---|---|');
  for (const s of SETS) { const d = R.diffs[s]; L.push(`| ${s} | ${f3(d.disc.diff)} | ${f2(d.disc.t)} | ${f3(d.conf.diff)} | ${f2(d.conf.t)} | ${d.disc.diff > 0 && d.conf.diff > 0 && d.disc.t >= 2 && d.conf.t >= 2 ? 'yes' : 'no'} |`); }
  L.push('', '## In plain words', '', R.reading, '',
    '## The unsplit rule, the days with no call, and the sides (after costs)', '', '| Market set | Window | All trades n | All after costs | month t | NONE n | NONE after costs | WITH buys | WITH sells | AGAINST buys | AGAINST sells | Call days buy / sell / none |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of SETS) for (const w of ['disc', 'conf']) { const x = R.extra[s][w], sd = (k) => `${f3(x.sides[k].mean)} (${x.sides[k].n})`;
    L.push(`| ${s} | ${w === 'disc' ? '2005-14' : '2015-26'} | ${x.all.n} | ${f3(x.all.mean)} | ${f2(x.all.t)} | ${x.none.n} | ${x.none.n ? f3(x.none.mean) : 'n/a'} | ${sd('WITH buys')} | ${sd('WITH sells')} | ${sd('AGAINST buys')} | ${sd('AGAINST sells')} | ${x.callDays.buy} / ${x.callDays.sell} / ${x.callDays.none} |`); }
  L.push('', '## Harness gate (the unsplit rules at these costs against the published studies)', '', '| Market | Window | Published n / after costs | Here n / after costs | Within 2 % and 0.01R |', '|---|---|---|---|---|');
  for (const g of R.gate) L.push(`| ${g.market} | ${g.from} to ${g.to} | ${g.want.n} / ${f3(g.want.netR)} | ${g.got.n} / ${f3(g.got.netR)} | ${g.ok ? 'yes' : 'no'} |`);
  L.push('', '## What this does not show', '',
    '- It does not re-test the breakouts: their trades were read before on every year here. Only the split by the call is new, and a WITH or AGAINST cell that is profitable is a subset of a rule that already is.',
    '- One fixed reading of the call (UTC-aligned H4 candles, UTC days with the weekend folded into Monday as the Daily, the function\'s own constants). Other ladders were not tried, and trying them on these trades now would be a search.',
    '- Today\'s measured cost is charged on every year; candles are OANDA mid, not broker ticks. Gold has no candles before March 2006.',
    '- Whatever the verdict, nothing here is an edge and nothing live changes.', '',
    '## Data and method', '', `- ${R.data}`,
    '- Month t: calendar months with a trade; p one-sided normal; Holm over the six cells on the 2015-26 p. Profit bar: n >= 300, after-cost mean > 0 and month t >= 2 in both windows, Holm p < 0.05. Pass: a WITH cell meets it and WITH minus AGAINST is > 0 with Welch t >= 2 in both windows.',
    '- To repeat: `node --max-old-space-size=3500 research/edge/vb-msnr-side/run.mjs` (the candle cache is kept out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-vol-breakout-hourcost/result.json'), 'utf8'));
  const all = [], gate = [], data = [];
  for (const mk of MARKETS) {
    let m5 = K.load(mk, '5m');
    const C = calls(m5);
    let rows = m5.map((b) => [b.t, b.o, b.h, b.l, b.c]);
    const first = new Date(m5[0].t * 1000).toISOString().slice(0, 10), n5 = m5.length; m5 = null;
    const { tr, dataEnd } = mk === 'xau' ? goldTrades(rows, hc.profile, hc.commission) : jpyTrades(rows);
    rows = null;
    tag(tr, C);
    gate.push(...gateOf(mk, tr));
    all.push(...tr);
    data.push(`${mk}: ${n5} five-minute candles ${first} to ${dataEnd}, ${C.h4.length} H4 candles, ${C.events} direction switches, ${tr.length} breakout trades`);
    console.log(data.at(-1));
  }
  all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const E = evaluate(all), gateOk = gate.every((g) => g.ok), verdict = verdictOf(E.cells, gateOk);
  const W = E.cells.filter((c) => c.group === 'WITH'), best = W.reduce((a, b) => (b.conf.mean > a.conf.mean ? b : a));
  const ag = E.cells.find((c) => c.set === best.set && c.group === 'AGAINST'), d = E.diffs[best.set];
  const headline = `${gateOk ? '' : 'Gate missed; '}best WITH cell ${best.cell} ${f3(best.conf.mean)}R a trade after costs in 2015-26 (n ${best.conf.n}, month t ${f2(best.conf.t)}) against ${f3(ag.conf.mean)}R AGAINST the call (n ${ag.conf.n}); WITH minus AGAINST ${f3(d.conf.diff)}R (Welch t ${f2(d.conf.t)}), 2005-14 ${f3(d.disc.diff)}R (t ${f2(d.disc.t)}).`;
  const prof = E.cells.filter((c) => c.profit).map((c) => c.cell), dl = (s) => `${s}: ${f3(E.diffs[s].disc.diff)}R (Welch t ${f2(E.diffs[s].disc.t)}) in 2005-14 and ${f3(E.diffs[s].conf.diff)}R (t ${f2(E.diffs[s].conf.t)}) in 2015-26`;
  const reading = `Cells meeting the profit bar: ${prof.length ? prof.join(', ') : 'none'}. Every cell is a subset of a rule that is already profitable at these costs, so that alone says nothing about the call. ` +
    `The question is the difference, WITH minus AGAINST after costs: ${SETS.map(dl).join('; ')}. ` +
    (verdict === 'PASS' ? 'A WITH cell meets the profit bar and the difference holds in both windows; by the pre-registration that is a hypothesis for its own test on other data, not an edge.'
      : verdict === 'FAIL' ? 'No market set has the difference above zero with a Welch t of 2 in both windows, so by the pre-registered reading the key-level direction call adds nothing to the breakouts that can be told from chance. The breakouts stay as they are, with no direction gate.'
        : 'No verdict is drawn (see the gate table and the trade counts).');
  const R = { study: 'vb-msnr-side', built: '2026-11-24', preregistration: 'research/edge/vb-msnr-side/PREREGISTRATION.md',
    planSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    verdict, headline, windows: WIN, costs: { xau: 'gold-vol-breakout-hourcost C1: hour spread profile + commission + 0.05 x M', usdjpy: '0.000045 of the entry + 0.5 pip a round trip' },
    gate, gateOk, cells: E.cells, passed: E.cells.filter((c) => c.pass).map((c) => c.cell), diffs: E.diffs, extra: E.extra, reading,
    data: data.join('; ') + '. Source: the shared toolkit\'s OANDA mid 5-minute cache.' };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  console.log(`Verdict: ${verdict}. ${headline}`);
  console.log(JSON.stringify(gate.map((g) => [g.market, g.from, g.want, g.got, g.ok])));
}
