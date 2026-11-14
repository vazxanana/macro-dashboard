// Edge research · gold-eur-vol-breakout: the gold-vol-breakout study's T1 (UTC open ± 0.5 × the previous folded day's range,
// stop back at the open, out at 21:00 UTC), unchanged, on OANDA gold priced in euros (XAU/EUR) M5, as fixed in
// PREREGISTRATION.md. Every trading function comes from original.mjs, a verbatim copy of that study's run.mjs (sha256 pinned in
// tests/gold-eur-vol-breakout.test.mjs); this file only sets the window, the cost per day (0.016 % of the day's open), runs the
// one test, the placebo and the descriptive comparison with XAU/USD, and writes the report.
//   node --use-env-proxy research/edge/gold-eur-vol-breakout/run.mjs fetch <dir>   (writes <dir>/xaueur-5m.json.gz, out of git)
//   node research/edge/gold-eur-vol-breakout/run.mjs <dir> [<xauDir>]
//     <dir>/xaueur-5m.json.gz   OANDA mid XAU/EUR M5 rows [t,o,h,l,c,v]
//     <xauDir>/xau-5m.json.gz   OANDA mid XAU/USD M5 rows [t,o,h,l,c] (the replicate study's cache; descriptive comparison only)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';

export const T1 = O.TESTS.T1;
export const COST_PCT = 0.00016;                         // a round trip, fraction of price (≈ $0.60 at $3,700), stated, not measured
export const WIN = { ALL: ['2006-04-01', '2026-10-31'], H1: ['2006-04-01', '2016-12-31'], H2: ['2017-01-01', '2026-10-31'] };
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
const DAY = 86400;
export const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the cost of one day's trade: 0.016 % of the day's open (known before any order)
export const costOf = (d) => COST_PCT * d.bars[0].o;

// the original's loader: sort, drop the forming last day, build folded days
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  return { days: O.buildDays(rows.filter((r) => r[0] < lastFull)), dataEnd: ymdOf(lastFull - DAY) };
}

// T1 trades on the days inside window w; cost = a function of the day (XAU/EUR) or a constant (XAU/USD reference)
export function tradesIn(days, w, cost = costOf, test = T1) {
  const tr = [], skips = {}, pool = [];
  for (const d of days) {
    if (!inW(d.day, w)) continue;
    const s = O.daySkip(d);
    if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    pool.push(d);
    const c = typeof cost === 'function' ? cost(d) : cost;
    const x = O.vbTrade(d.bars, { ...test, prevRange: d.prevRange, cost: c });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1;
    else tr.push({ day: d.day, cost: c, ...x });
  }
  return { tr, skips, pool };
}

// the original's placebo() on the pool of days T1 could trade, with the day's own cost
export function placeboIn(pool, cost = costOf, test = T1, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = test.sides === 'buy' ? 1 : coin < 0.5 ? 1 : -1;
      const c = typeof cost === 'function' ? cost(d) : cost;
      const x = O.placeboTrade(d.bars, { startT, side, dist: test.k * d.prevRange, cost: c }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}

// the pre-registered decision
export function decide(all, h1, h2, pl) {
  const beaten = pl.filter((v) => all.netR > v).length;
  const checks = { t2: all.t >= 2, h1Pos: h1.netR > 0, h2Pos: h2.netR > 0, cost2x: all.net2R > 0, placebo: beaten >= 38, n30: h1.n >= 30 && h2.n >= 30 };
  const p5 = (v) => Math.round(v * 1e5) / 1e5;
  return { p: p5(O.normP(all.t)), pHolm: p5(O.normP(all.t)), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
}
export const failed = (dec) => Object.entries(dec.checks).filter(([, v]) => !v).map(([c]) => c);

// descriptive: days both markets traded; correlation of R and same-side share
export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
export function compare(eur, usd) {
  const u = new Map(usd.map((x) => [x.day, x])), pairs = eur.filter((x) => u.has(x.day)).map((x) => [x, u.get(x.day)]);
  const same = pairs.filter(([a, b]) => a.side === b.side).length;
  return { days: pairs.length, eurOnly: eur.length - pairs.length, usdOnly: usd.length - pairs.length,
    corrGross: r3(pearson(pairs.map((p) => p[0].R), pairs.map((p) => p[1].R))),
    corrNet: r3(pearson(pairs.map((p) => p[0].net), pairs.map((p) => p[1].net))),
    sameSide: r3(same / (pairs.length || 1)) };
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(a, dec) {
  const f = failed(dec);
  return `${dec.pass ? 'PASS' : `FAIL (${f.join(', ')})`}: gold's T1 breakout on XAU/EUR 2006-04 → 2026-10 ${sg(a.netR)}R a trade net (n ${a.n}, month t ${s2(a.t)}; gross ${sg(a.grossR)}R, t ${s2(a.grossT)})`;
}
export function report(R) {
  const L = [], yn = (b) => (b ? 'yes' : 'no'), T = R.tests, d = R.decision, c = d.checks;
  const row = (lab, x) => `| ${lab} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`;
  L.push('# Gold in euros: gold-vol-breakout\'s T1 rule, unchanged, on XAU/EUR', '');
  L.push('Paper research only. Is the daily volatility breakout of `gold-vol-breakout` (passed on XAU/USD 2007-15, branch `gold-vol-breakout-replicate`) about gold itself or about the dollar leg? The same rule on gold priced in euros. Not a rule for any live book and never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. The rule, cost, window, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `original.mjs`, a verbatim copy of the original study\'s `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## XAU/EUR, T1', '');
  L.push('| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop € |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  L.push(row('2006-04 → 2026-10 (pooled)', T.ALL), row('2006-04 → 2016-12 (H1)', T.H1), row('2017-01 → 2026-10 (H2)', T.H2));
  L.push('', '## Decision (one test; Holm over one test is its own p)', '');
  L.push('| p (one-sided, pooled) | pooled t ≥ 2 | H1 > 0 | H2 > 0 | pooled 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each half | pass |', '|---|---|---|---|---|---|---|---|');
  L.push(`| ${d.p} | ${yn(c.t2)} | ${yn(c.h1Pos)} | ${yn(c.h2Pos)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`);
  const p = R.placebo;
  L.push('', '## Placebo (2006-04 → 2026-10, 40 seeds)', '', 'The original study\'s placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same cost per day.', '');
  L.push('| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|', `| ${sg(T.ALL.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`);
  L.push('', '## Sides and skipped days', '');
  for (const w of ['H1', 'H2']) L.push(`- ${w}: buys n ${T[w].buys.n} ${sg(T[w].buys.netR)}R, sells n ${T[w].sells.n} ${sg(T[w].sells.netR)}R; financing ${sg(T[w].finR)}R a trade.`);
  L.push(`- Days without a trade, whole window: ${Object.entries(T.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (XAU/EUR net and gross R a trade; XAU/USD reference net)', '');
  L.push('| Year | n | Net | Gross | Total R | XAU/USD net (n) |', '|---|---|---|---|---|---|');
  const uy = R.reference ? R.reference.ALL.byYear : {};
  for (const [y, b] of Object.entries(T.ALL.byYear)) L.push(`| ${y} | ${b.n} | ${sg(b.netR)} | ${sg(b.grossR)} | ${s2(b.total)} | ${uy[y] ? `${sg(uy[y].netR)} (${uy[y].n})` : '—'} |`);
  if (R.reference) {
    const U = R.reference, C = R.comparison;
    L.push('', '## Against XAU/USD (descriptive, pre-registered)', '');
    L.push(`The same T1 on OANDA XAU/USD M5 (the replicate study's cache, which starts ${U.from}), $0.60 a round trip, same window.`, '');
    L.push('| Market | Period | n | Net R/trade | Gross R/trade | Net 2x | t (months) | Gross t |', '|---|---|---|---|---|---|---|---|');
    for (const [lab, w] of [['pooled', 'ALL'], ['H1', 'H1'], ['H2', 'H2']]) {
      L.push(`| XAU/EUR | ${lab} | ${T[w].n} | ${sg(T[w].netR)} | ${sg(T[w].grossR)} | ${sg(T[w].net2R)} | ${s2(T[w].t)} | ${s2(T[w].grossT)} |`);
      L.push(`| XAU/USD | ${lab} | ${U[w].n} | ${sg(U[w].netR)} | ${sg(U[w].grossR)} | ${sg(U[w].net2R)} | ${s2(U[w].t)} | ${s2(U[w].grossT)} |`);
    }
    L.push('', `Days both markets took a T1 trade: ${C.days} (XAU/EUR only ${C.eurOnly}, XAU/USD only ${C.usdOnly}). Daily correlation of gross R ${C.corrGross}, of net R ${C.corrNet}; same side on ${(C.sameSide * 100).toFixed(1)} % of those days.`);
  }
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: ${(R.costPct * 100).toFixed(3)} % of the day's open a round trip (≈ $0.60 at $3,700; stated, not measured: no XAU/EUR spread is measured in the repository), 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys, assumed for XAU/EUR (no trade crosses the 22:00 UTC rollover: 0).`);
  L.push('- To repeat: `node --use-env-proxy research/edge/gold-eur-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/gold-eur-vol-breakout/run.mjs <dir> <xauDir>` (`<xauDir>/xau-5m.json.gz` = the replicate study\'s XAU/USD cache); candle caches stay out of the repository.');
  return L.join('\n') + '\n';
}

// ─── fetch: OANDA mid XAU/EUR M5 through the keyless candle proxy, in windows ───
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const start = Date.parse('2006-01-01') / 1000, end = Math.floor(Date.now() / 1000), W = 4500 * 300, wins = [], rows = new Map();
  for (let a = start; a < end; a += W) wins.push([a, Math.min(a + W, end)]);
  const one = async ([a, b]) => {
    for (let k = 0; k < 5; k++) {
      try {
        const r = await fetch(`https://meridianx.dev/md/bars?sym=xaueur&tf=5m&from=${a}&to=${b}`);
        if (r.status === 429 || r.status >= 500) throw new Error('status ' + r.status);
        const j = await r.json(); for (const x of j.bars || []) if (x.time >= a && x.time < b) rows.set(x.time, [x.time, x.open, x.high, x.low, x.close, x.volume]);
        return;
      } catch { await new Promise((s) => setTimeout(s, 2000 * (k + 1))); }
    }
    throw new Error('failed window ' + a);
  };
  for (let i = 0; i < wins.length; i += 4) { await Promise.all(wins.slice(i, i + 4).map(one)); await new Promise((s) => setTimeout(s, 400)); }
  const out = [...rows.values()].sort((x, y) => x[0] - y[0]);
  fs.writeFileSync(path.join(dir, 'xaueur-5m.json.gz'), zlib.gzipSync(JSON.stringify(out)));
  console.log(out.length, 'rows', ymdOf(out[0][0]), '→', ymdOf(out.at(-1)[0]));
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] === 'fetch') { await fetchAll(process.argv[3]); process.exit(0); }
  const dir = process.argv[2], xauDir = process.argv[3]; if (!dir) throw new Error('usage: node run.mjs <dir> [<xauDir>]');
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xaueur-5m.json.gz')))));
  const { tr, skips, pool } = tradesIn(days, WIN.ALL);
  const tests = { name: T1.name, k: T1.k, eligibleDays: pool.length, skips };
  for (const w of ['ALL', 'H1', 'H2']) tests[w] = O.summary(tr.filter((x) => inW(x.day, WIN[w])));
  for (const w of ['ALL', 'H1', 'H2']) for (const y of Object.keys(tests[w].byYear)) {
    const a = tr.filter((x) => x.day.startsWith(y)); tests[w].byYear[y].grossR = r3(mean(a.map((x) => x.R)));
  }
  const pl = placeboIn(pool), dec = decide(tests.ALL, tests.H1, tests.H2, pl);
  let reference = null, comparison = null;
  if (xauDir) {
    const u = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(xauDir, 'xau-5m.json.gz')))));
    const ut = tradesIn(u.days, WIN.ALL, O.COST).tr;
    reference = { from: u.days[0].day, cost: O.COST };
    for (const w of ['ALL', 'H1', 'H2']) reference[w] = O.summary(ut.filter((x) => inW(x.day, WIN[w])));
    comparison = compare(tr, ut);
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const a = tests.ALL, f = failed(dec), yrs = Object.values(a.byYear), posYears = yrs.filter((b) => b.netR > 0).length;
  const U = reference;
  const reading = (dec.pass ? 'T1 passes every pre-registered check on XAU/EUR. Paper research only; it says the breakout is in gold\'s own moves rather than only in the dollar, not that it is an edge to trade. '
    : `T1 does not pass the pre-registered bar on XAU/EUR (failed: ${f.join(', ')}). `)
    + `Pooled 2006-04 → 2026-10: ${sg(a.netR)}R a trade net (n ${a.n}, month t ${s2(a.t)}; gross ${sg(a.grossR)}R, t ${s2(a.grossT)}; ${sg(a.net2R)}R at 2x costs). H1 2006-16 ${sg(tests.H1.netR)}R (n ${tests.H1.n}, t ${s2(tests.H1.t)}; gross t ${s2(tests.H1.grossT)}); H2 2017-26 ${sg(tests.H2.netR)}R (n ${tests.H2.n}, t ${s2(tests.H2.t)}; gross t ${s2(tests.H2.grossT)}). `
    + `${dec.placeboBeaten} of 40 placebo seeds beaten (placebo median ${sg(r3(O.quantile(pl, 0.5)))}R). Costs take ${sg(a.costR).replace('+', '')}R a trade. ${posYears} of ${yrs.length} years positive after costs. `
    + (U ? `For reference the same rule on XAU/USD over the same window (from ${U.from}): ${sg(U.ALL.netR)}R net (n ${U.ALL.n}, t ${s2(U.ALL.t)}; gross t ${s2(U.ALL.grossT)}). On the ${comparison.days} days both traded, the two results correlate ${comparison.corrGross} (gross R) and take the same side ${(comparison.sameSide * 100).toFixed(1)} % of the time` + (comparison.sameSide >= 0.7 ? ': on most days the XAU/EUR trade is the XAU/USD trade with the dollar taken out, so gold\'s own move, not the dollar, sets the side. It is the same effect seen without the dollar leg, not a second, independent one to add beside XAU/USD. ' : ': the two often take different sides, so XAU/EUR is largely a different set of trades. ') : '')
    + (tests.H2.t < 2 ? `The later half alone does not reach t 2 (H2 month t ${s2(tests.H2.t)}, net ${sg(tests.H2.netR)}R), as on XAU/USD over the same years; the pre-registered bar is the pooled t. ` : '')
    + (U ? `Before costs the effect is smaller in euros (${sg(a.grossR)}R a trade against ${sg(U.ALL.grossR)}R on XAU/USD), so part of the XAU/USD gross may come with the dollar leg; the net figures are close only because the cost here is lower in R. ` : '')
    + `The cost here is a stated 0.016 % of price, not a measured XAU/EUR spread; it charges less in R than the XAU/USD reference\'s fixed $0.60 in the years gold was cheap. At twice it (0.032 %) the pooled stream is still ${sg(a.net2R)}R a trade, month t ${s2(a.t2x)}. `
    + (dec.pass ? 'Read with the XAU/USD result: the breakout does not depend on the dollar leg. Nothing live changes and no proposal is written.' : 'Nothing live changes and no proposal is written.');
  const result = { study: 'gold-eur-vol-breakout', built: '2026-11-14', preregistration: 'research/edge/gold-eur-vol-breakout/PREREGISTRATION.md', planSha256: sha, originalSha256: osha,
    claim: 'gold-vol-breakout\'s T1 rule (a move of 0.5 × the previous day\'s range away from the UTC open continues to 21:00 UTC) also holds on gold priced in euros, so it is about gold rather than the dollar leg',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close',
    data: `OANDA mid XAU/EUR M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, costPct: COST_PCT, windows: WIN, verdict: verdictLine(a, dec), decision: dec, tests,
    placebo: { seeds: O.SEEDS, start: '01:00-18:00 UTC', window: '2006-04 → 2026-10', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)) },
    reference, comparison, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const w of ['ALL', 'H1', 'H2']) console.log(w, JSON.stringify({ n: tests[w].n, net: tests[w].netR, gross: tests[w].grossR, t: tests[w].t, gt: tests[w].grossT, n2: tests[w].net2R, cost: tests[w].costR }), U ? JSON.stringify({ n: U[w].n, net: U[w].netR, t: U[w].t, gt: U[w].grossT }) : '');
  console.log('placebo', dec.placeboBeaten, Math.min(...pl), Math.max(...pl), skips, comparison);
}
