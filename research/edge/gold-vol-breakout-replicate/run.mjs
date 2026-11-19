// Edge research · gold-vol-breakout-replicate: the gold-vol-breakout study's T1 (UTC open ± 0.5 × the previous folded day's
// range, stop back at the open, out at 21:00 UTC), unchanged, on 2007-2015 OANDA spot gold M5, as fixed in PREREGISTRATION.md.
// Every trading function comes from original.mjs, a verbatim copy of that study's run.mjs (commit 72009ebe); this file only
// sets the windows, runs the harness gate, the one test, the placebo and the descriptive splits, and writes the report.
//   node research/edge/gold-vol-breakout-replicate/run.mjs <dir> [gate]
//     <dir>/xau-5m.json.gz      OANDA mid M5 rows [t,o,h,l,c] 2006-11 → (this study's cache, out of git)
//     <dir>/xau-5m-vol.json.gz  the original study's cache [t,o,h,l,c,v] 2015-12 → (harness gate only, out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';

export const T1 = O.TESTS.T1;
export const WIN = ['2007-01-01', '2015-12-31'];
export const HALVES = { H1: ['2007-01-01', '2011-12-31'], H2: ['2012-01-01', '2015-12-31'] };
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
// the original's published T1 (result.json of commit 72009ebe)
export const ORIG_T1 = {
  IS: { n: 935, netR: 0.009, grossR: 0.111, t: 0.22, grossT: 2.87, net2R: -0.094 },
  OOS: { n: 1121, netR: 0.072, grossR: 0.121, t: 1.86, grossT: 3.21, net2R: 0.023 },
};
export const ORIG_WIN = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-12-31'] };
export const TOL = { nPct: 0.01, R: 0.010, t: 0.15 };
export const MED_N = 250, MED_MIN = 20;
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the original's loader: sort, drop the forming last day, build folded days
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  return { days: O.buildDays(rows.filter((r) => r[0] < lastFull)), dataEnd: ymdOf(lastFull - DAY) };
}

// median of the last MED_N prevRange values up to and including this day's (all known before the open); null under MED_MIN
export function withMedian(days) {
  const out = [], buf = [];
  for (const d of days) {
    if (d.prevRange != null) { buf.push(d.prevRange); if (buf.length > MED_N) buf.shift(); }
    const med = buf.length >= MED_MIN ? O.quantile(buf, 0.5) : null;
    out.push({ ...d, med250: med });
  }
  return out;
}

// T1 trades on the days inside window w (the original's eligible() + runTest(), with the window as an argument)
export function tradesIn(days, w, test = T1) {
  const tr = [], skips = {}, pool = [];
  for (const d of days) {
    if (!inW(d.day, w)) continue;
    const s = O.daySkip(d);
    if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    pool.push(d);
    const x = O.vbTrade(d.bars, { ...test, prevRange: d.prevRange });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1;
    else tr.push({ day: d.day, prevRange: d.prevRange, med250: d.med250 ?? null, ...x });
  }
  return { tr, skips, pool };
}

// the original's placebo(), on the pool of days T1 could trade in window w
export function placeboIn(pool, test = T1, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = test.sides === 'buy' ? 1 : coin < 0.5 ? 1 : -1;
      const x = O.placeboTrade(d.bars, { startT, side, dist: test.k * d.prevRange }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}

const pick = (s) => ({ n: s.n, netR: s.netR, grossR: s.grossR, t: s.t, grossT: s.grossT, net2R: s.net2R });
// harness gate: exact on the original cache, within TOL on this study's cache
export function gateCheck(got, exact) {
  const out = {};
  for (const w of ['IS', 'OOS']) {
    const a = got[w], b = ORIG_T1[w], diff = {};
    for (const k of Object.keys(b)) diff[k] = r3(a[k] - b[k]);
    const ok = exact ? Object.keys(b).every((k) => a[k] === b[k])
      : Math.abs(a.n - b.n) <= TOL.nPct * b.n && Math.abs(diff.netR) <= TOL.R + 1e-9 && Math.abs(diff.grossR) <= TOL.R + 1e-9 && Math.abs(diff.t) <= TOL.t + 1e-9;
    out[w] = { got: pick(a), want: b, diff, ok };
  }
  out.ok = out.IS.ok && out.OOS.ok;
  return out;
}
export function gateRun(days, exact) {
  const { tr } = tradesIn(days, [ORIG_WIN.IS[0], ORIG_WIN.OOS[1]]);
  const got = { IS: O.summary(tr.filter((x) => inW(x.day, ORIG_WIN.IS))), OOS: O.summary(tr.filter((x) => inW(x.day, ORIG_WIN.OOS))) };
  return gateCheck(got, exact);
}

// the pre-registered decision
export function decide(main, h1, h2, pl) {
  const beaten = pl.filter((v) => main.netR > v).length;
  const checks = { netPos: main.netR > 0, t2: main.t >= 2, h1Pos: h1.netR > 0, h2Pos: h2.netR > 0, cost2x: main.net2R > 0, placebo: beaten >= 38, n30: main.n >= 30 };
  return { placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean), p: r3(O.normP(main.t)) };
}

// descriptive: prevRange above vs at-or-below its 250-day median
export function rangeSplit(tr) {
  const one = (a) => { const m = O.monthT(a); return { n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), t: r2(m.t) }; };
  const ok = tr.filter((x) => x.med250 != null);
  return { high: one(ok.filter((x) => x.prevRange > x.med250)), low: one(ok.filter((x) => x.prevRange <= x.med250)), noMedian: tr.length - ok.length };
}
export function withoutBestYear(tr) {
  const by = {}; for (const x of tr) by[x.day.slice(0, 4)] = (by[x.day.slice(0, 4)] || 0) + x.net;
  const best = Object.entries(by).sort((a, b) => b[1] - a[1])[0][0], rest = tr.filter((x) => !x.day.startsWith(best)), m = O.monthT(rest);
  return { year: best, yearTotal: r2(by[best]), n: rest.length, netR: r3(mean(rest.map((x) => x.net))), t: r2(m.t) };
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(m, dec) {
  const fail = Object.entries(dec.checks).filter(([, v]) => !v).map(([k]) => k);
  return `${dec.pass ? 'PASS' : 'FAIL'}: gold open ± 0.5 × prior range breakout on untouched 2007-15 ${sg(m.netR)}R a trade net (n ${m.n}, month t ${s2(m.t)}, gross ${sg(m.grossR)}R)${dec.pass ? '' : `; failed ${fail.join(', ')}`}`;
}
export function report(R) {
  const L = [], yn = (b) => (b ? 'yes' : 'no'), M = R.main, row = (lab, x) => `| ${lab} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`;
  L.push('# Gold: the intraday volatility breakout, replicated on 2007-2015', '');
  L.push('Paper research only. A stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The test, window and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is the `gold-vol-breakout` study\'s T1, its functions imported from `original.mjs`, a verbatim copy of that study\'s `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate', '');
  L.push('| Cache | Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Original n / net / t | Pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [c, g] of [['original cache (exact)', R.gate.exact], ['this study\'s cache (tolerance)', R.gate.tol]]) for (const w of ['IS', 'OOS']) {
    const x = g[w].got, o = g[w].want; L.push(`| ${c} | ${w === 'IS' ? '2016-20' : '2021-26'} | ${x.n} | ${sg(x.netR)} | ${sg(x.grossR)} | ${s2(x.t)} | ${s2(x.grossT)} | ${sg(x.net2R)} | ${o.n} / ${sg(o.netR)} / ${s2(o.t)} | ${yn(g[w].ok)} |`);
  }
  L.push('', '## The test, 2007-2015', '');
  L.push('| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  L.push(row('2007-2015', M), row('2007-2011', R.halves.H1), row('2012-2015', R.halves.H2), row(`pooled 2007 → ${R.dataEnd}`, R.pooled));
  L.push('', '## Decision (one test, no correction)', '');
  const c = R.decision.checks;
  L.push('| net > 0 | month t ≥ 2 | 2007-11 > 0 | 2012-15 > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|');
  L.push(`| ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.h1Pos)} | ${yn(c.h2Pos)} | ${yn(c.cost2x)} | ${R.decision.placeboBeaten} | ${yn(c.n30)} | **${R.decision.pass ? 'pass' : 'fail'}** |`);
  const p = R.placebo;
  L.push('', '## Placebo (2007-2015, 40 seeds)', '', 'The original study\'s placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs.', '');
  L.push('| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|', `| ${sg(M.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`);
  L.push('', '## By year (2007-2015 and the pooled record)', '', '| Year | n | Net R/trade | Total R |', '|---|---|---|---|');
  for (const [y, b] of Object.entries(R.pooled.byYear)) L.push(`| ${y} | ${b.n} | ${sg(b.netR)} | ${s2(b.total)} |`);
  L.push('', '## Does it rest on high-range days? (descriptive, pre-registered)', '');
  L.push('Previous day\'s range above vs at or below the median of the last 250 previous-day ranges (this day\'s included, known before the open).', '');
  L.push('| Period | High range: n / net / gross / t | Low range: n / net / gross / t |', '|---|---|---|');
  for (const [lab, s] of [['2007-2015', R.split.main], [`pooled 2007 → ${R.dataEnd}`, R.split.pooled]]) L.push(`| ${lab} | ${s.high.n} / ${sg(s.high.netR)} / ${sg(s.high.grossR)} / ${s2(s.high.t)} | ${s.low.n} / ${sg(s.low.netR)} / ${sg(s.low.grossR)} / ${s2(s.low.t)} |`);
  const wb = R.withoutBest; L.push('', `2007-2015 without its best year (${wb.year}, ${s2(wb.yearTotal)}R): n ${wb.n}, ${sg(wb.netR)}R a trade, month t ${s2(wb.t)}.`);
  L.push('', '## Sides and skipped days', '', `- 2007-2015: buys n ${M.buys.n} ${sg(M.buys.netR)}R, sells n ${M.sells.n} ${sg(M.sells.netR)}R; financing ${sg(M.finR)}R a trade; days without a trade: ${Object.entries(R.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce, 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys (no trade crosses the 22:00 UTC rollover: 0).`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout-replicate/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy) and, for the harness gate, `<dir>/xau-5m-vol.json.gz` (the original study\'s cache); both out of git.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir> [gate]');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const exact = gateRun(daysOf(load(path.join(dir, 'xau-5m-vol.json.gz'))).days, true);
  const { days: raw, dataEnd } = daysOf(load(path.join(dir, 'xau-5m.json.gz')));
  const days = withMedian(raw), tol = gateRun(days, false);
  console.log('gate exact', exact.ok, JSON.stringify(exact.IS.diff), JSON.stringify(exact.OOS.diff));
  console.log('gate tol  ', tol.ok, JSON.stringify(tol.IS.diff), JSON.stringify(tol.OOS.diff));
  if (!exact.ok || !tol.ok) { console.log('harness gate failed: stop'); process.exit(2); }
  if (process.argv[3] === 'gate') process.exit(0);
  const { tr, skips, pool } = tradesIn(days, WIN), pooledTr = tradesIn(days, [WIN[0], dataEnd]).tr;
  const main = O.summary(tr), H1 = O.summary(tr.filter((x) => inW(x.day, HALVES.H1))), H2 = O.summary(tr.filter((x) => inW(x.day, HALVES.H2)));
  const pooled = O.summary(pooledTr), pl = placeboIn(pool), dec = decide(main, H1, H2, pl);
  const split = { main: rangeSplit(tr), pooled: rangeSplit(pooledTr) }, withoutBest = withoutBestYear(tr);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const fail = Object.entries(dec.checks).filter(([, v]) => !v).map(([k]) => k).join(', ');
  const reading = (dec.pass ? 'T1 passes every pre-registered check on the untouched 2007-2015 gold history. Paper research only: at most a candidate for a forward paper record, by the owner\'s decision; nothing live changes. '
    : `T1 does not pass on the untouched 2007-2015 history (failed: ${fail}). `)
    + `2007-15: ${sg(main.netR)}R a trade net (n ${main.n}, month t ${s2(main.t)}), gross ${sg(main.grossR)}R (t ${s2(main.grossT)}); 2007-11 ${sg(H1.netR)}R (n ${H1.n}), 2012-15 ${sg(H2.netR)}R (n ${H2.n}); at 2x costs ${sg(main.net2R)}R; ${dec.placeboBeaten} of 40 placebo seeds beaten (placebo median ${sg(r3(O.quantile(pl, 0.5)))}R). `
    + `Costs take ${sg(main.costR).replace('+', '')}R a trade at a median stop of $${main.medianStop}. Pooled 2007 → ${dataEnd}: ${sg(pooled.netR)}R net (n ${pooled.n}, month t ${s2(pooled.t)}), gross ${sg(pooled.grossR)}R (t ${s2(pooled.grossT)}). `
    + `High-range days (previous range above its 250-day median) 2007-15 ${sg(split.main.high.netR)}R (n ${split.main.high.n}), low-range ${sg(split.main.low.netR)}R (n ${split.main.low.n}); descriptive only. `
    + (() => { const ys = Object.entries(pooled.byYear).filter(([y]) => y >= '2015' && y <= '2024'), n = ys.reduce((a, [, b]) => a + b.n, 0), tot = ys.reduce((a, [, b]) => a + b.total, 0);
      return `Cautions, said plainly: the cost is the original's fixed $0.60 a round trip, today's level; spreads of 2007-15 were not measured, and at 2x costs the rule keeps only ${sg(main.net2R)}R a trade (pooled 2007-26 ${sg(pooled.net2R)}R). The record is two good stretches with a flat one between: 2015-2024 together ${s2(r2(tot))}R on ${n} trades. The gain does not come from wide-range days; it comes from days after a narrower-than-usual range. A pass here is evidence for the rule's direction on gold, not proof of a tradeable edge at real costs. `; })()
    + (dec.pass ? '' : 'Not an edge. With the original study\'s failure this ends the line of tests of this rule on gold; nothing live changes and no proposal is written.');
  const result = { study: 'gold-vol-breakout-replicate', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-replicate/PREREGISTRATION.md', planSha256: sha,
    original: { study: 'gold-vol-breakout', commit: '72009ebe62c4aa56ff7d4ea8a621fbe64a643e3e', runSha256: ORIG_SHA, how: 'run.mjs copied verbatim as original.mjs; its functions imported, none changed' },
    claim: 'the gold-vol-breakout T1 rule holds on gold history its study never saw (2007-2015)',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, cost: O.COST, window: WIN, halfWindows: HALVES, verdict: verdictLine(main, dec), decision: dec,
    gate: { exact, tol, tolerance: TOL }, main, halves: { H1, H2 }, skips, pooled, split, withoutBest,
    placebo: { seeds: O.SEEDS, start: '01:00-18:00 UTC', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  console.log(JSON.stringify({ main: pick(main), H1: pick(H1), H2: pick(H2), pooled: pick(pooled), beaten: dec.placeboBeaten, split, withoutBest }));
}
