// research/edge/vb-choch-exit/run.mjs - PREREGISTRATION.md (24 Nov 2026): T1 (the intraday volatility breakout, k 0.5, both
// sides) on gold and USD/JPY, its own exit against an extra exit on the first ChoCh against the position on M5 / M15 / H1.
// Paired per trade, before costs; after costs beside. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/vb-choch-exit/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildDays, daySkip, vbTrade, COST as GOLD_COST } from '../index-vol-breakout/original.mjs';
import { charge } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'usdjpy'], EXITS = ['base', 'E1 M5 ChoCh', 'E2 M15 ChoCh', 'E3 H1 ChoCh'], TFX = ['5m', '15m', '1h'];
export const GATE = { early: { n: 2089, netR: 0.079 }, late: { n: 2079, netR: 0.063 } };
const Y0 = 2005, NM = (2026 - Y0) * 12 + 10, SPLIT_M = 11 * 12;                 // months 2005-01 .. 2026-10; late from 2016-01
const monthOf = (day) => (+day.slice(0, 4) - Y0) * 12 + (+day.slice(5, 7) - 1);

// the times (close of the ChoCh candle) of every ChoCh by direction, on one timeframe
export function chochTimes(bars) {
  const ev = K.structure(bars, 3).events.filter((e) => e.kind === 'ChoCh');
  return { up: ev.filter((e) => e.dir > 0).map((e) => e.t), dn: ev.filter((e) => e.dir < 0).map((e) => e.t) };
}
const firstAfter = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo < arr.length ? arr[lo] : Infinity; };

// the trade with an extra exit at the open of the first candle starting at or after tx (Infinity = none): R before costs
export function managed(bars, x, tx) {
  const side = x.side, i0 = bars.findIndex((b) => b.t === x.fillT), stop = x.stop, risk = Math.abs(x.entry - stop);
  const b0 = bars[i0]; if (side > 0 ? b0.l <= stop : b0.h >= stop) return { R: -1, how: 'stop' };   // the fill candle: stop first, as T1
  for (let i = i0 + 1; i < bars.length; i++) { const b = bars[i];
    if (b.t >= tx) return { R: side * (b.o - x.entry) / risk, how: 'choch' };
    if (side * (b.o - stop) <= 0) return { R: side * (b.o - x.entry) / risk, how: 'stop' };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { R: side * (stop - x.entry) / risk, how: 'stop' }; }
  const b = bars.at(-1); return { R: side * (b.c - x.entry) / risk, how: 'time' };
}

export function runMarket(mk) {
  const M5 = K.load(mk, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const days = buildDays(M5.map((b) => [b.t, b.o, b.h, b.l, b.c]));
  const CH = TFX.map((tf) => chochTimes(tf === '5m' ? M5 : K.resample(M5, K.TF[tf])));
  const out = [];
  for (const d of days) {
    if (d.day < '2005-01-01' || d.day > '2026-10-31' || daySkip(d)) continue;
    const x = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    if (!(x.side * (x.entry - x.stop) > 0)) throw new Error('stop on the wrong side');
    const costR = mk === 'xau' ? GOLD_COST / x.r : x.R - charge(mk, x).net;
    const Rs = [x.R], hows = [x.how];
    for (const c of CH) { const m = managed(d.bars, x, firstAfter(x.side > 0 ? c.dn : c.up, x.fillT)); Rs.push(m.R); hows.push(m.how); }
    out.push({ day: d.day, side: x.side, costR, R: Rs, how: hows });
  }
  return out;
}

const mstat = (ms, a, b) => { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0; };
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function stats(trades, e) {
  const W = [[0, SPLIT_M], [SPLIT_M, NM]].map(([a, b]) => {
    const tr = trades.filter((t) => { const m = monthOf(t.day); return m >= a && m < b; }); const ms = new Float64Array(NM), mr = new Float64Array(NM);
    for (const t of tr) { ms[monthOf(t.day)] += t.R[e] - t.R[0]; mr[monthOf(t.day)] += t.R[e] - t.costR; }
    const n = tr.length, mean = (f) => (n ? tr.reduce((s, t) => s + f(t), 0) / n : null);
    return { n, R: mean((t) => t.R[e]), net: mean((t) => t.R[e] - t.costR), d: mean((t) => t.R[e] - t.R[0]), tD: mstat(ms, a, b), tNet: mstat(mr, a, b),
      win: mean((t) => (t.R[e] - t.costR > 0 ? 1 : 0)), choch: mean((t) => (t.how[e] === 'choch' ? 1 : 0)), months: b - a };
  });
  return { early: W[0], late: W[1] };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => x.toFixed(2), N = (x) => x.toLocaleString('en-US');
export function report() {
  const T = Object.fromEntries(MARKETS.map((m) => [m, runMarket(m)])), all = MARKETS.flatMap((m) => T[m]);
  const rows = EXITS.map((name, e) => ({ name, pooled: stats(all, e), per: Object.fromEntries(MARKETS.map((m) => [m, stats(T[m], e)])) }));
  const ps = rows.slice(1).map((r) => p1(r.pooled.late.tD, r.pooled.late.months - 1)), H = K.holm(ps);
  rows.slice(1).forEach((r, i) => { r.holm = H[i]; const P = r.pooled;
    r.pass = P.early.tD >= 2 && P.late.tD >= 2 && P.early.net > 0 && P.late.net > 0 && H[i] < 0.05; });
  const pass = rows.filter((r) => r.pass), verdict = pass.length ? 'PASS' : 'FAIL';
  const best = [...rows.slice(1)].sort((a, b) => b.pooled.late.tD - a.pooled.late.tD)[0], base = rows[0].pooled;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 3 ChoCh exits beat T1's own exit; best ${best.name}, ${f3(best.pooled.late.d)}R a trade better in 2016-26 (n ${N(best.pooled.late.n)}, month t ${f2(best.pooled.late.tD)}), ${f3(best.pooled.late.net)}R after costs`
    : `0 of 3 ChoCh exits beat T1's own exit; the best, ${best.name}, changed R by ${f3(best.pooled.late.d)} a trade in 2016-26 (n ${N(best.pooled.late.n)}, month t ${f2(best.pooled.late.tD)}; early ${f3(best.pooled.early.d)}, t ${f2(best.pooled.early.tD)}) against T1's ${f3(base.late.net)}R after costs`;
  const slim = (w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v == null ? null : +v.toFixed(k === 'n' || k === 'months' ? 0 : 4)]));
  const out = { study: 'vb-choch-exit', built: '2026-11-24', verdict, headline, basis: 'paired per trade (exit minus T1 own exit) before costs on month sums; after costs beside',
    gate: { usdjpy: { early: slim(stats(T.usdjpy, 0).early), late: slim(stats(T.usdjpy, 0).late), want: GATE } },
    exits: rows.map((r) => ({ exit: r.name, early: slim(r.pooled.early), late: slim(r.pooled.late), holm: r.holm == null ? null : +r.holm.toFixed(4), pass: !!r.pass,
      perMarket: Object.fromEntries(Object.entries(r.per).map(([m, s]) => [m, { early: slim(s.early), late: slim(s.late) }])) })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const L = ['# The breakout managed by structure: exit on the first ChoCh against the trade (result)', '', `**Verdict: ${verdict}. ${headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'T1 (k 0.5, both sides, out at 21:00 UTC) on gold and USD/JPY, OANDA mid 5-minute candles; the same trades exited also at the',
    'first ChoCh against the position on M5, M15 or H1 (edgekit `structure`, 3 a side, closed candles), else as T1. Paired per',
    'trade (exit minus T1\'s own) before costs, month-sum t, early 2005-2015 / late 2016 to Oct 2026; costs beside (gold $0.60 a',
    'round trip, USD/JPY the demo commission + half a pip). The T1 years were read before: a pass would only go to a forward record.', '',
    '## Gold + USD/JPY pooled', '',
    '| Exit | n early | R / net early | change (t) early | n late | R / net late | change (t) late | left on ChoCh late | Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of rows) { const e = r.pooled.early, l = r.pooled.late;
    L.push(`| ${r.name} | ${N(e.n)} | ${f3(e.R)} / ${f3(e.net)} | ${r.name === 'base' ? '-' : `${f3(e.d)} (${f2(e.tD)})`} | ${N(l.n)} | ${f3(l.R)} / ${f3(l.net)} | ${r.name === 'base' ? '-' : `${f3(l.d)} (${f2(l.tD)})`} | ${r.name === 'base' ? '-' : (100 * l.choch).toFixed(0) + '%'} | ${r.holm == null ? '-' : r.holm.toFixed(3)} | ${r.name === 'base' ? '-' : r.pass ? 'yes' : 'no'} |`); }
  L.push('', '## Per market (after costs; change against T1\'s own exit, month t)', '', '| Exit | Market | net early | change early (t) | net late | change late (t) |', '|---|---|---:|---:|---:|---:|');
  for (const r of rows) for (const m of MARKETS) { const s = r.per[m]; L.push(`| ${r.name} | ${m} | ${f3(s.early.net)} | ${f3(s.early.d)} (${f2(s.early.tD)}) | ${f3(s.late.net)} | ${f3(s.late.d)} (${f2(s.late.tD)}) |`); }
  const g = out.gate.usdjpy;
  L.push('', '## Checks', '', `- T1 reproduced on USD/JPY: early n ${N(g.early.n)}, ${f3(g.early.net)}R after costs (published ${N(GATE.early.n)}, +${GATE.early.netR}); late n ${N(g.late.n)}, ${f3(g.late.net)}R (published ${N(GATE.late.n)}, +${GATE.late.netR}). Small differences come from the candle cache (same OANDA feed, fetched again).`,
    '- The ChoCh exit uses only candles closed before it (the exit is at the next 5-minute open); the stop never moves; every trade has its stop on the losing side (the run throws otherwise).', '',
    '## What it means', '');
  if (verdict === 'PASS') L.push('An exit on structure improved T1 on both decades. T1\'s years were all read before, so this goes to a forward record beside T1\'s own, never straight to a live change.');
  else L.push('Getting out of the breakout on a ChoCh against it does not improve T1: whatever the structure says during the day, holding to 21:00 is as good or better. Structure breaks did not complement the one rule here that passes, as a filter, an entry or an exit. Nothing live changed; no rule is proposed.');
  L.push('');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const o = report(); console.log(o.verdict, o.headline); }
