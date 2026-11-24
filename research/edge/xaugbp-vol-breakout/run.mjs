// Edge research · xaugbp-vol-breakout: gold-vol-breakout's T1 (UTC open ± 0.5 × the previous folded day's range, stop back at
// the open, out at 21:00 UTC), unchanged, on OANDA gold priced in pounds (XAU/GBP) M5, as fixed in PREREGISTRATION.md. Every
// trading function comes from research/edge/index-vol-breakout/original.mjs (sha256 checked); the cost is exactly
// gold-eur-vol-breakout's (0.016 % of the day's open a round trip). This file sets the windows, runs the one test, the placebo
// and the descriptive XAU/USD comparison, and writes result.json and RESULT.md.
//   node --use-env-proxy research/edge/xaugbp-vol-breakout/run.mjs fetch <dir>   (writes <dir>/xaugbp-5m.json.gz, out of git)
//   node research/edge/xaugbp-vol-breakout/run.mjs <dir>    (XAU/USD reference from edgekit's xau 5m cache)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../index-vol-breakout/original.mjs';

export const T1 = O.TESTS.T1;
export const COST_PCT = 0.00016;                // gold-eur-vol-breakout's COST_PCT, stated, not measured
export const WIN = { ALL: ['2006-04-01', '2026-10-31'], DISC: ['2006-04-01', '2015-12-31'], CONF: ['2016-01-01', '2026-10-31'] };
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_PATH = path.join(HERE, '..', 'index-vol-breakout', 'original.mjs');
const DAY = 86400;
export const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const costOf = (d) => COST_PCT * d.bars[0].o;

export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  return { days: O.buildDays(rows.filter((r) => r[0] < lastFull)), dataEnd: ymdOf(lastFull - DAY) };
}

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

export function placeboIn(pool, cost = costOf, test = T1, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = coin < 0.5 ? 1 : -1;
      const c = typeof cost === 'function' ? cost(d) : cost;
      const x = O.placeboTrade(d.bars, { startT, side, dist: test.k * d.prevRange, cost: c }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}

export function decide(disc, conf, pl) {
  const beaten = pl.filter((v) => conf.netR > v).length;
  const checks = { confT2: conf.t >= 2, discPos: disc.netR > 0, confPos: conf.netR > 0, conf2x: conf.net2R > 0, placebo: beaten >= 38, n200: conf.n >= 200 };
  const p = Math.round(O.normP(conf.t) * 1e5) / 1e5;
  return { p, pHolm: p, placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
}
export const failed = (dec) => Object.entries(dec.checks).filter(([, v]) => !v).map(([c]) => c);

export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
export function monthSums(tr) { const m = new Map(); for (const x of tr) m.set(x.day.slice(0, 7), (m.get(x.day.slice(0, 7)) || 0) + x.net); return m; }
export function compare(g, u) {
  const um = new Map(u.map((x) => [x.day, x])), pairs = g.filter((x) => um.has(x.day)).map((x) => [x, um.get(x.day)]);
  const gm = monthSums(g), umm = monthSums(u), ks = [...gm.keys()].filter((k) => umm.has(k));
  return { days: pairs.length, gbpOnly: g.length - pairs.length, usdOnly: u.length - pairs.length,
    corrDailyGross: r3(pearson(pairs.map((p) => p[0].R), pairs.map((p) => p[1].R))),
    corrDailyNet: r3(pearson(pairs.map((p) => p[0].net), pairs.map((p) => p[1].net))),
    sameSide: r3(pairs.filter(([a, b]) => a.side === b.side).length / (pairs.length || 1)),
    months: ks.length, corrMonthlyNet: r3(pearson(ks.map((k) => gm.get(k)), ks.map((k) => umm.get(k)))) };
}

// ─── report ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(T, dec) {
  const c = T.CONF, d = T.DISC;
  return `${dec.pass ? 'PASS' : `FAIL (${failed(dec).join(', ')})`}: gold's T1 breakout on XAU/GBP, confirmation 2016-01 → 2026-10 ${sg(c.netR)}R a trade net (n ${c.n}, month t ${s2(c.t)}); discovery 2006-04 → 2015-12 ${sg(d.netR)}R (n ${d.n}, t ${s2(d.t)})`;
}
export function report(R) {
  const L = [], T = R.tests, d = R.decision, c = d.checks, yn = (b) => (b ? 'yes' : 'no');
  const row = (lab, x) => `| ${lab} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${s2(x.maxDD)} |`;
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('# Gold in pounds: gold-vol-breakout\'s T1 rule, unchanged, on XAU/GBP', '');
  L.push('Paper research only. Is the daily volatility breakout a gold effect whatever currency gold is priced in? It passed on XAU/USD and on XAU/EUR (`gold-eur-vol-breakout`, +0.067R, month t 3.50); here the same rule on gold priced in pounds. The rule, cost, windows, placebo and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `research/edge/index-vol-breakout/original.mjs` (sha256 checked). Never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. Written by `run.mjs` from `result.json`.', '');
  L.push('## XAU/GBP, T1', '');
  L.push('| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Max DD R |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  L.push(row('Discovery 2006-04 → 2015-12', T.DISC), row('Confirmation 2016-01 → 2026-10', T.CONF), row('Pooled', T.ALL));
  L.push('', '## Decision (one test; Holm over one test is its own p)', '');
  L.push('| p (one-sided, confirmation) | conf. t ≥ 2 | disc. > 0 | conf. > 0 | conf. 2x cost > 0 | placebos beaten (need 38 of 40) | conf. n ≥ 200 | pass |', '|---|---|---|---|---|---|---|---|');
  L.push(`| ${d.p} | ${yn(c.confT2)} | ${yn(c.discPos)} | ${yn(c.confPos)} | ${yn(c.conf2x)} | ${d.placeboBeaten} | ${yn(c.n200)} | **${d.pass ? 'pass' : 'fail'}** |`);
  const p = R.placebo;
  L.push('', '## Placebo (confirmation window, 40 seeds)', '', '| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|', `| ${sg(T.CONF.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`);
  L.push('', '## Sides', '');
  for (const w of ['DISC', 'CONF']) L.push(`- ${w === 'DISC' ? 'Discovery' : 'Confirmation'}: buys n ${T[w].buys.n} ${sg(T[w].buys.netR)}R, sells n ${T[w].sells.n} ${sg(T[w].sells.netR)}R.`);
  L.push(`- Days without a trade (pooled): ${Object.entries(T.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (XAU/GBP net R a trade; XAU/USD reference net)', '', '| Year | n | Net | Gross | Total R | XAU/USD net (n) |', '|---|---|---|---|---|---|');
  const uy = R.reference.ALL.byYear;
  for (const [y, b] of Object.entries(T.ALL.byYear)) L.push(`| ${y} | ${b.n} | ${sg(b.netR)} | ${sg(b.grossR)} | ${s2(b.total)} | ${uy[y] ? `${sg(uy[y].netR)} (${uy[y].n})` : '—'} |`);
  const U = R.reference, C = R.comparison;
  L.push('', '## Against XAU/USD (descriptive, pre-registered)', '', `The same T1 on OANDA XAU/USD M5 (edgekit's cache, from ${U.from}), $0.60 a round trip, same windows.`, '');
  L.push('| Market | Period | n | Net R/trade | Gross R/trade | Net 2x | t (months) | Gross t |', '|---|---|---|---|---|---|---|---|');
  for (const [lab, w] of [['discovery', 'DISC'], ['confirmation', 'CONF'], ['pooled', 'ALL']]) {
    L.push(`| XAU/GBP | ${lab} | ${T[w].n} | ${sg(T[w].netR)} | ${sg(T[w].grossR)} | ${sg(T[w].net2R)} | ${s2(T[w].t)} | ${s2(T[w].grossT)} |`);
    L.push(`| XAU/USD | ${lab} | ${U[w].n} | ${sg(U[w].netR)} | ${sg(U[w].grossR)} | ${sg(U[w].net2R)} | ${s2(U[w].t)} | ${s2(U[w].grossT)} |`);
  }
  L.push('', `Monthly net-R sums, XAU/GBP against XAU/USD, over ${C.months} months both traded: correlation **${C.corrMonthlyNet}**. Days both took a T1 trade: ${C.days} (XAU/GBP only ${C.gbpOnly}, XAU/USD only ${C.usdOnly}); daily correlation gross R ${C.corrDailyGross}, net R ${C.corrDailyNet}; same side on ${(C.sameSide * 100).toFixed(1)} % of those days.`);
  L.push('', '## Reading', '', R.reading, '', '## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`,
    '- Costs: exactly `gold-eur-vol-breakout`\'s model: 0.016 % of the day\'s open a round trip (≈ $0.60 at $3,700), stated, not measured (no XAU/GBP spread is measured in the repository; it is likely wider than XAU/USD\'s); financing `FIN.xau.long` × `nights` on buys, assumed (no trade crosses the rollover). 2x reported and in the bar.',
    '- To repeat: `node --use-env-proxy research/edge/xaugbp-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/xaugbp-vol-breakout/run.mjs <dir>` (XAU/USD from edgekit\'s xau 5m cache); candle caches stay out of the repository.');
  return L.join('\n') + '\n';
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const start = Date.parse('2006-01-01') / 1000, end = Math.floor(Date.now() / 1000), W = 4500 * 300, wins = [], rows = new Map();
  for (let a = start; a < end; a += W) wins.push([a, Math.min(a + W, end)]);
  const one = async ([a, b]) => {
    for (let k = 0; k < 6; k++) {
      try {
        const r = await fetch(`https://aureumdesk.co.uk/md/bars?sym=xaugbp&tf=5m&from=${a}&to=${b}`);
        if (r.status === 429 || r.status >= 500) throw new Error('status ' + r.status);
        const j = await r.json(); for (const x of j.bars || []) if (x.time >= a && x.time < b) rows.set(x.time, [x.time, x.open, x.high, x.low, x.close, x.volume]);
        return;
      } catch { await new Promise((s) => setTimeout(s, 2000 * (k + 1))); }
    }
    throw new Error('failed window ' + a);
  };
  for (let i = 0; i < wins.length; i += 4) { await Promise.all(wins.slice(i, i + 4).map(one)); await new Promise((s) => setTimeout(s, 300)); }
  const out = [...rows.values()].sort((x, y) => x[0] - y[0]);
  fs.writeFileSync(path.join(dir, 'xaugbp-5m.json.gz'), zlib.gzipSync(JSON.stringify(out)));
  console.log(out.length, 'rows', ymdOf(out[0][0]), '→', ymdOf(out.at(-1)[0]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] === 'fetch') { await fetchAll(process.argv[3]); process.exit(0); }
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <dir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(ORIG_PATH)).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs changed');
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xaugbp-5m.json.gz')))));
  const { tr, skips, pool } = tradesIn(days, WIN.ALL);
  const tests = { name: T1.name, k: T1.k, eligibleDays: pool.length, skips };
  for (const w of ['ALL', 'DISC', 'CONF']) tests[w] = O.summary(tr.filter((x) => inW(x.day, WIN[w])));
  for (const y of Object.keys(tests.ALL.byYear)) tests.ALL.byYear[y].grossR = r3(mean(tr.filter((x) => x.day.startsWith(y)).map((x) => x.R)));
  const pl = placeboIn(pool.filter((d) => inW(d.day, WIN.CONF))), dec = decide(tests.DISC, tests.CONF, pl);
  const E = await import('../_lib/edgekit.mjs');
  const urows = E.load('xau', '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const u = daysOf(urows), ut = tradesIn(u.days, WIN.ALL, O.COST).tr;
  const reference = { from: u.days[0].day, cost: O.COST };
  for (const w of ['ALL', 'DISC', 'CONF']) reference[w] = O.summary(ut.filter((x) => inW(x.day, WIN[w])));
  const comparison = compare(tr, ut);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const C = tests.CONF, D = tests.DISC;
  const reading = (dec.pass ? 'T1 passes every pre-registered check on XAU/GBP. ' : `T1 does not pass the pre-registered bar on XAU/GBP (failed: ${failed(dec).join(', ')}). `)
    + `Confirmation 2016-01 → 2026-10: ${sg(C.netR)}R a trade net (n ${C.n}, month t ${s2(C.t)}; gross ${sg(C.grossR)}R, t ${s2(C.grossT)}; ${sg(C.net2R)}R at 2x costs). Discovery 2006-04 → 2015-12: ${sg(D.netR)}R (n ${D.n}, t ${s2(D.t)}; gross t ${s2(D.grossT)}). `
    + `${dec.placeboBeaten} of 40 placebo seeds beaten on the confirmation window (placebo median ${sg(r3(O.quantile(pl, 0.5)))}R). `
    + `XAU/USD over the same windows: confirmation ${sg(reference.CONF.netR)}R (n ${reference.CONF.n}, t ${s2(reference.CONF.t)}), discovery ${sg(reference.DISC.netR)}R (t ${s2(reference.DISC.t)}). `
    + `Monthly net-R correlation with XAU/USD T1 ${comparison.corrMonthlyNet} over ${comparison.months} months; same side on ${(comparison.sameSide * 100).toFixed(1)} % of shared days: `
    + (comparison.corrMonthlyNet >= 0.5 ? 'largely the same trades as XAU/USD with the dollar taken out, so it adds little to a book that holds XAU/USD. ' : 'only partly the same trades as XAU/USD. ')
    + (reference.CONF.t < 2 ? `XAU/USD itself would not clear this confirmation bar either (month t ${s2(reference.CONF.t)} on 2016-26 at the old $0.60 cost; the measured-cost studies are what carry it there), so the 2016-26 window is a hard test for this rule on any gold quote. ` : '')
    + `Before costs XAU/GBP's confirmation is ${sg(C.grossR)}R (gross month t ${s2(C.grossT)}) against XAU/USD's ${sg(reference.CONF.grossR)}R (t ${s2(reference.CONF.grossT)}): the pound quote keeps about a third of the dollar quote's gross; a before-cost tilt is not an edge. Worst confirmation drawdown ${s2(C.maxDD)}R. `
    + 'The cost is a stated 0.016 % of price, not a measured XAU/GBP spread. '
    + (dec.pass ? 'Read with XAU/USD and XAU/EUR, the breakout follows gold rather than its quote currency; that is a finding about the effect, not an edge to trade. ' : '')
    + 'Nothing live changes and no proposal is written.';
  const result = { study: 'xaugbp-vol-breakout', built: '2026-11-24', preregistration: 'research/edge/xaugbp-vol-breakout/PREREGISTRATION.md', planSha256: sha, originalSha256: osha,
    claim: 'gold-vol-breakout\'s T1 rule also holds on gold priced in pounds, so it follows gold whatever the quote currency',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close',
    data: `OANDA mid XAU/GBP M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, costPct: COST_PCT, windows: WIN, decision: dec, tests,
    placebo: { seeds: O.SEEDS, window: 'confirmation', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)) },
    reference, comparison, reading };
  result.verdict = verdictLine(tests, dec);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const w of ['DISC', 'CONF', 'ALL']) console.log(w, JSON.stringify({ n: tests[w].n, net: tests[w].netR, gross: tests[w].grossR, t: tests[w].t, n2: tests[w].net2R }), JSON.stringify({ n: reference[w].n, net: reference[w].netR, t: reference[w].t }));
  console.log('placebo', dec.placeboBeaten, comparison);
}
