// Edge research · gold-vol-breakout-reverse: on the days the gold-vol-breakout T1 trade is stopped back at the open, keep the
// opposite stop order (unchanged level) live until 21:00 UTC (a stop-and-reverse straddle), as fixed in PREREGISTRATION.md.
// Every T1 function comes from original.mjs, a verbatim copy of the original study's run.mjs (sha256 pinned below); this file
// adds only the reverse order, the placebo at the same fill candle, the Holm table and the report.
//   node research/edge/gold-vol-breakout-reverse/run.mjs <dir>
//     <dir>/xau-5m.json.gz   OANDA mid M5 rows [t,o,h,l,c] 2006-11 → (the replicate study's cache, out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const K = 0.5, NOON = 12 * 3600;
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] };
export const GATE = { n: 1657, netR: 0.111, grossR: 0.203, net2R: 0.018, t: 3.19, grossT: 5.96 };
export const GATE_WIN = ['2007-01-01', '2015-12-31'];
export const TESTS = { R1: 'reverse trade alone', R2: 'combined day minus T1 alone', R3: 'reverse trade, first stop-out before 12:00 UTC' };
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the original's loader: sort, drop the forming last day, folded UTC days
export function load(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, keep = rows.filter((r) => r[0] < lastFull);
  return { days: O.buildDays(keep), dataEnd: ymdOf(lastFull - DAY) };
}

// the original's close(): R, nights, financing on buys, net and 2x net
export function closeOut(side, entry, stop, exit, fillT, exitT, how, cost = O.COST) {
  const r = Math.abs(entry - stop), R = side * (exit - entry) / r;
  const n = side > 0 ? nights(fillT, exitT) : 0, fin = side > 0 ? n * FIN.xau.long * entry / r : 0;
  return { side, entry, stop, r, exit, how, R, nights: n, finR: fin, net: R - cost / r - fin, net2: R - 2 * cost / r - 2 * fin };
}
// the original's walk(): an open position from candle j on (a candle opening through the stop exits at its open)
export function walkFrom(bars, j, side, stop) {
  for (let i = j; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}

// the day: T1 (the original's vbTrade, unchanged) and, when it is stopped at O, the reverse order
export function dayTrades(bars, prevRange, { k = K, cost = O.COST } = {}) {
  const t1 = O.vbTrade(bars, { k, sides: 'both', prevRange, cost });
  if (t1.skip) return { t1 };
  if (t1.how !== 'stop') return { t1 };
  const side1 = t1.side, Op = t1.open, fi = bars.findIndex((b) => b.t === t1.fillT);
  let si = -1;                                                     // stop-out candle: the first from the fill candle reaching O
  for (let i = fi; i < bars.length; i++) if (side1 > 0 ? bars[i].l <= Op : bars[i].h >= Op) { si = i; break; }
  const stopOut = { idx: si, t: bars[si].t, hour: Math.floor((bars[si].t % DAY) / 3600) };
  const side = -side1, level = side > 0 ? t1.up : t1.dn;
  for (let i = si + 1; i < bars.length; i++) {
    const b = bars[i];
    if (!(side > 0 ? b.h >= level : b.l <= level)) continue;
    const entry = side > 0 ? Math.max(level, b.o) : Math.min(level, b.o);
    const x = (side > 0 ? b.l <= Op : b.h >= Op) ? { exit: Op, how: 'stop', t: b.t } : walkFrom(bars, i + 1, side, Op);
    return { t1, stopOut, rev: { fillT: b.t, fillIdx: i, ...closeOut(side, entry, Op, x.exit, b.t, x.t, x.how, cost) } };
  }
  return { t1, stopOut, rev: null };
}

export function runAll(days, w) {
  const out = [];
  for (const d of days) {
    if (!inW(d.day, w) || O.daySkip(d)) continue;
    const x = dayTrades(d.bars, d.prevRange);
    if (x.t1.skip) continue;
    out.push({ day: d.day, bars: d.bars, ...x });
  }
  return out;
}

// ─── statistics ───
export const cell = (tr) => { const s = O.summary(tr); return { n: s.n, win: s.win, netR: s.netR, grossR: s.grossR, net2R: s.net2R, t: s.t, grossT: s.grossT, t2x: s.t2x, finR: s.finR, stops: s.stops, time: s.time, medianStop: s.medianStop, maxDD: s.maxDD, total: s.total, buys: s.buys, sells: s.sells, byYear: s.byYear }; };
const revOf = (rows) => rows.filter((x) => x.rev).map((x) => ({ day: x.day, ...x.rev, stopHour: x.stopOut.hour }));
const r3Of = (rows) => revOf(rows.filter((x) => x.stopOut && x.stopOut.t % DAY < NOON));
// R2: one row per T1 day, the difference combined − T1 alone (= the reverse trade's R, 0 without one)
export function diffRows(rows) {
  return rows.map((x) => ({ day: x.day, net: x.rev ? x.rev.net : 0, R: x.rev ? x.rev.R : 0, net2: x.rev ? x.rev.net2 : 0 }));
}
function dd(v) { let eq = 0, pk = 0, m = 0; for (const a of v) { eq += a; pk = Math.max(pk, eq); m = Math.min(m, eq - pk); } return m; }
export function combined(rows) {
  const t1 = rows.map((x) => ({ day: x.day, net: x.t1.net, R: x.t1.R, net2: x.t1.net2 }));
  const cb = rows.map((x) => ({ day: x.day, net: x.t1.net + (x.rev ? x.rev.net : 0), R: x.t1.R + (x.rev ? x.rev.R : 0), net2: x.t1.net2 + (x.rev ? x.rev.net2 : 0) }));
  const df = diffRows(rows), side = (a) => ({ days: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), net2R: r3(mean(a.map((x) => x.net2))),
    total: r2(a.reduce((s, x) => s + x.net, 0)), t: r2(O.monthT(a).t), grossT: r2(O.monthT(a, 'R').t), maxDD: r2(dd(a.map((x) => x.net))) });
  return { t1: side(t1), combined: side(cb), diff: { ...side(df), t2x: r2(O.monthT(df, 'net2').t), months: O.monthT(df).months } };
}
export function fillRate(rows) {
  const so = rows.filter((x) => x.stopOut), f = so.filter((x) => x.rev).length;
  return { t1Days: rows.length, t1Stops: so.length, revFills: f, rate: r3(f / (so.length || 1)) };
}
export function byHour(rows) {
  const h = {};
  for (const x of rows.filter((y) => y.stopOut)) {
    const k = String(x.stopOut.hour).padStart(2, '0'); (h[k] ||= { stopOuts: 0, fills: 0, net: 0 });
    h[k].stopOuts++; if (x.rev) { h[k].fills++; h[k].net += x.rev.net; }
  }
  for (const k in h) h[k] = { stopOuts: h[k].stopOuts, fills: h[k].fills, netR: h[k].fills ? r3(h[k].net / h[k].fills) : null };
  return h;
}
// placebo: per real reverse trade a market entry at the open of its fill candle, coin side, the same 1R, the original's placeboTrade
export function placeboMeans(rows, seeds = O.SEEDS) {
  const res = { R1: [], R2: [], R3: [] };
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), all = [], early = [];
    let dsum = 0;
    for (const x of rows) {
      if (!x.rev) continue;
      const side = rand() < 0.5 ? 1 : -1, p = O.placeboTrade(x.bars, { startT: x.rev.fillT, side, dist: x.rev.r });
      if (!p) continue;
      all.push(p.net); dsum += p.net; if (x.stopOut.t % DAY < NOON) early.push(p.net);
    }
    res.R1.push(r3(mean(all))); res.R3.push(r3(mean(early))); res.R2.push(r3(dsum / rows.length));
  }
  return res;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ts = { R1: res.R1.OOS.t, R2: res.R2.OOS.diff.t, R3: res.R3.OOS.t };
  const ps = ks.map((k) => O.normP(ts[k])), adj = O.holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = k === 'R2' ? { n: res.R2.OOS.diff.days, netR: res.R2.OOS.diff.netR, net2R: res.R2.OOS.diff.net2R } : res[k].OOS;
    const isNet = k === 'R2' ? res.R2.IS.diff.netR : res[k].IS.netR, beaten = pl[k].filter((v) => o.netR > v).length;
    const checks = { t2: ts[k] >= 2, holm: adj[i] < 0.05, isSame: isNet > 0 && o.netR > 0, cost2x: o.net2R > 0, n150: o.n >= 150, placebo: beaten >= 38 };
    d[k] = { t: ts[k], p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const o = res.R1.OOS, fail = Object.entries(dec.R1.checks).filter(([, v]) => !v).map(([c]) => c);
  return `${dec.R1.pass ? 'PASS' : 'FAIL'}: the reverse trade after a T1 stop-out made ${sg(o.netR)}R a trade net 2017-26 (n ${o.n}, month t ${s2(o.t)}), 2007-16 ${sg(res.R1.IS.netR)}R${dec.R1.pass ? '' : `; failed ${fail.join(', ')}`}`;
}
export function report(R) {
  const L = [], yn = (b) => (b ? 'yes' : 'no'), W = { IS: '2007-2016', OOS: '2017 → 2026-10' };
  L.push('# Gold: the volatility breakout as a stop-and-reverse straddle', '');
  L.push('Paper research only. A stand-alone question about the `gold-vol-breakout` T1 rule (not a gate, exit, entry or size of the live gold book, none of whose records were read): on the days T1 is stopped back at the open, is the cancelled opposite stop order worth keeping until 21:00 UTC? Every window of the base rule had been read by three studies before this one; no reverse trade had been computed. Nothing live changed, no proposal. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); T1 comes from `original.mjs`, a verbatim copy of the original `run.mjs`. This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate', '', `T1 on 2007-01-01 → 2015-12-31 against the replicate's published figure: n ${R.gate.got.n} (${R.gate.want.n}), net ${sg(R.gate.got.netR)} (${sg(R.gate.want.netR)}), gross ${sg(R.gate.got.grossR)} (${sg(R.gate.want.grossR)}), 2x ${sg(R.gate.got.net2R)} (${sg(R.gate.want.net2R)}), month t ${s2(R.gate.got.t)} (${s2(R.gate.want.t)}), gross t ${s2(R.gate.got.grossT)} (${s2(R.gate.want.grossT)}): exact ${yn(R.gate.ok)}.`, '');
  L.push('## Reverse trades (R1, R3)', '');
  L.push('| Test | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x | Total R | Month t | Gross t | t at 2x | Stops / time | Max DD R | Median stop $ |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['R1', 'R3']) for (const w of ['IS', 'OOS']) { const x = R.tests[k][w]; L.push(`| ${k} | ${W[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`); }
  L.push('', '## The combined day against T1 alone (R2, per T1 day)', '');
  L.push('| Period | Series | Days | Net R a day | Gross R a day | Net at 2x | Total R | Month t | Gross t | Max DD R |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const w of ['IS', 'OOS']) for (const s of ['t1', 'combined', 'diff']) { const x = R.tests.R2[w][s]; L.push(`| ${W[w]} | ${{ t1: 'T1 alone', combined: 'T1 + reverse', diff: 'difference' }[s]} | ${x.days} | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.maxDD)} |`); }
  L.push('', '## Decision (out of sample, Holm over R1-R3; only R1 decides)', '');
  L.push('| Test | Month t | p | Holm p | t ≥ 2 | Holm < 0.05 | in sample > 0 (and out of sample > 0) | 2x cost > 0 | n ≥ 150 | placebos beaten (need 38 of 40) | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${s2(d.t)} | ${d.p} | ${d.pHolm} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isSame)} | ${yn(c.cost2x)} | ${yn(c.n150)} | ${d.placeboBeaten} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '', 'For every real reverse trade, a market entry at the open of the same fill candle, side by a fair coin, stop the same distance away, out at 21:00 UTC or the stop, the same costs. R2: the placebo trades added to the T1 days, per day.', '');
  L.push('| Test | Real net R | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|---|');
  for (const k of Object.keys(R.placebo)) { const p = R.placebo[k], real = k === 'R2' ? R.tests.R2.OOS.diff.netR : R.tests[k].OOS.netR; L.push(`| ${k} | ${sg(real)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## How often the reverse order fills', '');
  L.push('| Period | T1 days | T1 stopped at O | Reverse filled | Fill rate |', '|---|---|---|---|---|');
  for (const w of ['IS', 'OOS']) { const f = R.fills[w]; L.push(`| ${W[w]} | ${f.t1Days} | ${f.t1Stops} | ${f.revFills} | ${(f.rate * 100).toFixed(1)} % |`); }
  L.push('', '## By UTC hour of the first stop-out (whole period)', '', '| Hour | T1 stop-outs | Reverse fills | Net R a reverse trade |', '|---|---|---|---|');
  for (const h of Object.keys(R.byHour).sort()) { const x = R.byHour[h]; L.push(`| ${h}:00 | ${x.stopOuts} | ${x.fills} | ${sg(x.netR)} |`); }
  L.push('', '## By year (R1, net R a trade, n)', '', '| Year | Net R | n | Total R |', '|---|---|---|---|');
  const yrs = { ...R.tests.R1.IS.byYear, ...R.tests.R1.OOS.byYear };
  for (const y of Object.keys(yrs).sort()) L.push(`| ${y} | ${sg(yrs[y].netR)} | ${yrs[y].n} | ${s2(yrs[y].total)} |`);
  L.push('', `Sides, out of sample (R1): buys n ${R.tests.R1.OOS.buys.n} ${sg(R.tests.R1.OOS.buys.netR)}R, sells n ${R.tests.R1.OOS.sells.n} ${sg(R.tests.R1.OOS.sells.netR)}R.`);
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`, `- Costs: $${R.cost.toFixed(2)} a round trip per ounce, 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys (no trade crosses 22:00 UTC: 0).`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout-reverse/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy; out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const { days, dataEnd } = load(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  const gRows = runAll(days, GATE_WIN), g = cell(gRows.map((x) => ({ day: x.day, ...x.t1 })));
  const gOk = Object.keys(GATE).every((k) => g[k] === GATE[k]);
  console.log('gate', gOk, JSON.stringify(Object.fromEntries(Object.keys(GATE).map((k) => [k, g[k]]))));
  if (!gOk) { console.log('harness gate failed: stop'); process.exit(2); }
  const rows = { IS: runAll(days, WINDOWS.IS), OOS: runAll(days, WINDOWS.OOS) }, res = { R1: {}, R2: {}, R3: {} }, fills = {};
  for (const w of ['IS', 'OOS']) { res.R1[w] = cell(revOf(rows[w])); res.R3[w] = cell(r3Of(rows[w])); res.R2[w] = combined(rows[w]); fills[w] = fillRate(rows[w]); }
  const plm = placeboMeans(rows.OOS), dec = decide(res, plm);
  const placebo = Object.fromEntries(Object.entries(plm).map(([k, v]) => [k, { seeds: O.SEEDS, means: v, min: Math.min(...v), max: Math.max(...v), median: r3(O.quantile(v, 0.5)), p95: r3(O.quantile(v, 0.95)) }]));
  const hours = byHour([...rows.IS, ...rows.OOS]), verdict = verdictLine(res, dec);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.R1.OOS, i = res.R1.IS, c = res.R2.OOS, ci = res.R2.IS;
  const fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([x]) => x).join(', ') || 'none';
  const reading = `R1 ${dec.R1.pass ? 'passes every pre-registered check' : `does not pass (failed: ${fail('R1')})`}. `
    + `Reverse trade 2017 → 2026-10: ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}; gross ${sg(o.grossR)}R, t ${s2(o.grossT)}; at 2x costs ${sg(o.net2R)}R); 2007-16 ${sg(i.netR)}R net (n ${i.n}, t ${s2(i.t)}; gross ${sg(i.grossR)}R). `
    + `The reverse order fills on ${(fills.OOS.rate * 100).toFixed(0)} % of the out-of-sample stop-out days (${fills.OOS.revFills} of ${fills.OOS.t1Stops}); its median stop is $${o.medianStop} (about 0.5 × the previous range from the open) and costs take ${sg(o.grossR - o.netR).replace('+', '')}R a trade. Before costs the reverse trade is ${o.grossR > 0 ? 'positive' : 'negative'} out of sample (gross t ${s2(o.grossT)}) and ${i.grossR > 0 ? 'positive' : 'negative'} in sample (gross t ${s2(i.grossT)}). `
    + `Per T1 day, adding the reverse order moves net R a day from ${sg(c.t1.netR)} to ${sg(c.combined.netR)} out of sample (difference t ${s2(c.diff.t)}; worst drawdown ${s2(c.t1.maxDD)}R → ${s2(c.combined.maxDD)}R) and from ${sg(ci.t1.netR)} to ${sg(ci.combined.netR)} in sample. `
    + `R3 (first stop-out before 12:00 UTC): ${sg(res.R3.OOS.netR)}R out of sample (n ${res.R3.OOS.n}, t ${s2(res.R3.OOS.t)}), ${sg(res.R3.IS.netR)}R in sample; ${dec.R3.pass ? 'passes its checks' : `failed: ${fail('R3')}`}. `
    + `Placebo (same fill candle, coin side, same stop): the real R1 beats ${dec.R1.placeboBeaten} of 40 seeds. `
    + 'Every window of the base rule was read before this study; only the reverse trade was new. '
    + (dec.R1.pass ? 'Paper research only: at most a candidate for its own forward paper record by the owner\'s decision; nothing live changes.' : 'Not an edge; the T1 rule stays as it was (the other order is cancelled), nothing live changes and no proposal is written.');
  const result = { study: 'gold-vol-breakout-reverse', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-reverse/PREREGISTRATION.md', planSha256: sha,
    original: { study: 'gold-vol-breakout', commit: '72009ebe62c4aa56ff7d4ea8a621fbe64a643e3e', runSha256: ORIG_SHA, how: 'run.mjs copied verbatim as original.mjs (as in gold-vol-breakout-replicate); its functions imported, none changed' },
    claim: 'after the gold-vol-breakout T1 trade is stopped back at the UTC open, the opposite stop order (unchanged level) kept live to 21:00 UTC makes money net of costs',
    rule: 'T1 unchanged (O = first M5 open from 00:00 UTC, stops at O ± 0.5 × previous folded D1 range, first fill wins, stop at O, out at 21:00 UTC). After a T1 stop-out at O, the opposite stop order at its own level is live from the candle after the stop-out candle to the 20:55 candle; stop at O (worst case in the fill candle); out at the 20:55 close',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} UTC weekdays built ${days[0].day} → ${days.at(-1).day}`,
    dataEnd, cost: O.COST, windows: WINDOWS, verdict, gate: { want: GATE, got: g, ok: gOk }, tests: res, decision: dec, placebo, fills, byHour: hours, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(verdict, verdict.length);
  for (const k of ['R1', 'R3']) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.netR, res[k].IS.grossR, res[k].IS.t], OOS: [res[k].OOS.n, res[k].OOS.netR, res[k].OOS.grossR, res[k].OOS.t, res[k].OOS.net2R] }));
  console.log('R2', JSON.stringify(res.R2.OOS), JSON.stringify(dec), JSON.stringify(fills));
}
