// Edge research · asia-index-vol-breakout: gold-vol-breakout's T1 rule, unchanged, on OANDA mid M5 JP225, AU200 and HK33
// (buy stop at the UTC open + 0.5 × the previous day's range, sell stop at the open − 0.5 × that range, stop back at the open,
// out at 21:00 UTC), as fixed in PREREGISTRATION.md. The rule's functions are imported, unchanged, from
// research/edge/index-vol-breakout/original.mjs (a byte-for-byte copy of gold-vol-breakout's run.mjs; sha256 checked below) and
// the index financing / recost from research/edge/index-vol-breakout/run.mjs. Only the markets, the cost (0.04 % of the entry
// price a round trip) and the windows change. Pure pieces are exported for tests/asia-index-vol-breakout.test.mjs.
//   node research/edge/asia-index-vol-breakout/run.mjs     (reads the edgekit cache: $EDGE_DATA/<market>/5m-<year>.json.gz)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, monthT, normP, holm, rng, quantile, summary } from '../index-vol-breakout/original.mjs';
import { recost, ORIGINAL_SHA } from '../index-vol-breakout/run.mjs';
import { load, DATA_DIR } from '../_lib/edgekit.mjs';

// HK33 was dropped in PREREGISTRATION.md before any trade: no 00:00-00:55 UTC candle and never 200 candles a day (T1 skips every day)
export const MARKETS = { jp225: 'JP225 (Nikkei 225 CFD)', au200: 'AU200 (ASX 200 CFD)' };
export const COST_PCT = 0.0004;                       // round trip, share of the entry price (gotobi-jp225's figure)
export const T1 = { k: 0.5, sides: 'both' };
export const WINDOWS = { D: ['2000-01-01', '2015-12-31'], C: ['2016-01-01', '2026-12-31'] };
export const SEEDS = 40, PLACEBO = { from: 1 * 3600, to: 18 * 3600 }, EARLY_S = 6 * 3600;
const DAY = 86400;
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// one trade's cost in price units: 0.04 % of its own entry
export const costOf = (x) => COST_PCT * x.entry;
export function runMarket(days, end) {
  const tr = [], skips = {};
  for (const d of days) {
    if (d.day > end) continue;
    const s = daySkip(d); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    const x = vbTrade(d.bars, { k: T1.k, sides: T1.sides, prevRange: d.prevRange, cost: 0 });
    if (x.skip) { skips[x.skip] = (skips[x.skip] || 0) + 1; continue; }
    tr.push({ day: d.day, early: x.fillT - d.d0 < EARLY_S, ...recost(x, costOf(x)) });
  }
  return { tr, skips };
}
// placebo on the confirmation window: every tradable day, one market entry at a random 5-minute mark 01:00-18:00 UTC,
// side by a fair coin, stop 0.5 × prevRange away, out at 21:00 UTC or the stop, the same cost
export function placeboTrades(days, end, seed) {
  const rand = rng(seed), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, tr = [];
  for (const d of days) {
    if (!inW(d.day, [WINDOWS.C[0], end]) || daySkip(d)) continue;
    const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange, cost: 0 });
    if (x) tr.push(recost(x, costOf(x)));
  }
  return tr;
}
export function decide(S, pl) {
  const ks = [...Object.keys(MARKETS), 'pooled'], ps = ks.map((k) => normP(S[k].C.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const c = S[k].C, beaten = pl[k].filter((v) => c.netR > v).length;
    const checks = { discPos: S[k].D.netR > 0, confPos: c.netR > 0, t2: c.t >= 2, holm: adj[i] < 0.05, cost2x: c.net2R > 0,
      placebo: beaten >= 38, n: c.n >= 200 && S[k].D.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
const NM = { jp225: 'JP225', au200: 'AU200', pooled: 'Pooled' };
const failed = (d) => Object.entries(d.checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
export function verdictLine(S, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length;
  const one = (k) => `${NM[k]} ${sg(S[k].C.netR)}R (n ${S[k].C.n}, t ${s2(S[k].C.t)}; gross ${sg(S[k].C.grossR)}R)`;
  return `${n ? 'PASS' : 'FAIL'}, ${n} of 3: T1 breakout after 0.04 % costs, 2016 → now: ${['jp225', 'au200', 'pooled'].map(one).join(', ')}`;
}
export function report(R) {
  const L = [], S = R.stats, yn = (b) => (b ? 'yes' : 'no'), ks = ['jp225', 'au200', 'pooled'];
  L.push('# Asian index CFDs: gold\'s intraday volatility breakout, unchanged (UTC open ± 0.5 × the previous day\'s range)', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('Paper research only; nothing live changed, no proposal. Rule, markets, cost, windows, placebo and bar were committed alone first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is imported unchanged from `research/edge/index-vol-breakout/original.mjs` (sha256 checked). This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Results (R a trade; net = after 0.04 % of price a round trip; t = t of calendar-month sums)', '');
  L.push('| Market | Window | n | Win | Net R | Gross R | Net at 2x cost | Cost R | Total net R | Month t | Gross t | 2x t | Max DD R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ks) for (const w of ['D', 'C']) {
    const x = S[k][w];
    L.push(`| ${NM[k]} | ${w === 'D' ? `discovery ${R.firstDay[k] || 'start'} → 2015` : `confirmation 2016 → ${R.dataEnd}`} | ${x.n} | ${x.n ? (x.win * 100).toFixed(1) + ' %' : '—'} | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${s2(x.maxDD)} |`);
  }
  L.push('', '## Decision (confirmation month t, one-sided normal p, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | discovery > 0 | confirmation > 0 | t ≥ 2 | Holm < 0.05 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 200 conf, ≥ 30 disc | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ks) { const d = R.decision[k], c = d.checks; L.push(`| ${NM[k]} | ${d.p} | ${d.pHolm} | ${yn(c.discPos)} | ${yn(c.confPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Placebo (confirmation window, 40 seeds)', '', '| Test | Real net R | Placebo median | Placebo 95th pct | min / max |', '|---|---|---|---|---|');
  for (const k of ks) { const p = R.placebo[k]; L.push(`| ${NM[k]} | ${sg(S[k].C.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## Reported only: early (fill before 06:00 UTC) against late fills, confirmation window', '', '| Market | Early n | Early net R | Early month t | Late n | Late net R | Late month t |', '|---|---|---|---|---|---|---|');
  for (const k of ks) { const e = R.early[k]; L.push(`| ${NM[k]} | ${e.early.n} | ${sg(e.early.netR)} | ${s2(e.early.t)} | ${e.late.n} | ${sg(e.late.netR)} | ${s2(e.late.t)} |`); }
  L.push('', '## Sides, skipped days, by year', '');
  for (const k of ks.slice(0, 2)) L.push(`- ${NM[k]}, confirmation: buys n ${S[k].C.buys.n} ${sg(S[k].C.buys.netR)}R, sells n ${S[k].C.sells.n} ${sg(S[k].C.sells.netR)}R; days without a trade (whole file): ${Object.entries(R.skips[k]).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  const ys = [...new Set(ks.flatMap((k) => [...Object.keys(S[k].D.byYear), ...Object.keys(S[k].C.byYear)]))].sort();
  L.push('', '| Year | JP225 | AU200 | Pooled |', '|---|---|---|---|');
  for (const y of ys) L.push(`| ${y} | ` + ks.map((k) => { const b = S[k].D.byYear[y] || S[k].C.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`, `- Costs: ${R.costs}`,
    '- To repeat: fill the edgekit cache (`node --use-env-proxy research/edge/_lib/fetch-cache.mjs <jp225|au200> 5m 2005 2026`), then `node research/edge/asia-index-vol-breakout/run.mjs`.');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '../index-vol-breakout/original.mjs'))).digest('hex');
  if (osha !== ORIGINAL_SHA) throw new Error('original.mjs is not the gold-vol-breakout run.mjs');
  const all = {}, pls = {}, skipsAll = {}, spans = {}, firstDay = {}; let dataEnd = null;
  const dayLists = {};
  for (const k of Object.keys(MARKETS)) {
    const rows = load(k, '5m').map((b) => (Array.isArray(b) ? b : [b.t, b.o, b.h, b.l, b.c])); rows.sort((a, b) => a[0] - b[0]);
    const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, end = ymdOf(lastFull - DAY);
    dataEnd = dataEnd && dataEnd < end ? dataEnd : end;
    const days = buildDays(rows.filter((r) => r[0] < lastFull));
    dayLists[k] = { days, end };
    spans[k] = { rows: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 16), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 16), weekdays: days.length };
  }
  for (const k of Object.keys(MARKETS)) {
    const { days } = dayLists[k], { tr, skips } = runMarket(days, dataEnd);
    all[k] = tr; skipsAll[k] = skips; firstDay[k] = tr[0]?.day || null;
    pls[k] = Array.from({ length: SEEDS }, (_, i) => placeboTrades(days, dataEnd, i + 1));
  }
  all.pooled = Object.keys(MARKETS).flatMap((k) => all[k]);
  pls.pooled = Array.from({ length: SEEDS }, (_, i) => Object.keys(MARKETS).flatMap((k) => pls[k][i]));
  const S = {}, pl = {}, early = {};
  for (const k of Object.keys(all)) {
    S[k] = { D: summary(all[k].filter((x) => inW(x.day, WINDOWS.D))), C: summary(all[k].filter((x) => inW(x.day, [WINDOWS.C[0], dataEnd]))) };
    pl[k] = pls[k].map((tr) => r3(mean(tr.map((x) => x.net))));
    const c = all[k].filter((x) => inW(x.day, [WINDOWS.C[0], dataEnd])), part = (a) => ({ n: a.length, netR: r3(mean(a.map((x) => x.net))), t: r2(monthT(a).t) });
    early[k] = { early: part(c.filter((x) => x.early)), late: part(c.filter((x) => !x.early)) };
  }
  const dec = decide(S, pl), npass = Object.values(dec).filter((x) => x.pass).length;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const one = (k) => `${NM[k]} confirmation ${sg(S[k].C.netR)}R net (n ${S[k].C.n}, month t ${s2(S[k].C.t)}; gross ${sg(S[k].C.grossR)}R, gross t ${s2(S[k].C.grossT)}; discovery ${sg(S[k].D.netR)}R, n ${S[k].D.n}; 2x cost ${sg(S[k].C.net2R)}R; ${dec[k].placeboBeaten} of 40 placebos beaten; ${dec[k].pass ? 'passes' : `failed: ${failed(dec[k])}`})`;
  const gross = ['jp225', 'au200'].filter((k) => S[k].C.grossR > 0 && S[k].C.netR <= 0);
  const reading = ['jp225', 'au200', 'pooled'].map(one).join('. ') + '. '
    + `Costs take ${sg(S.pooled.C.costR).replace('+', '')}R a trade pooled in confirmation. `
    + (gross.length ? `Before costs the breakout leans the right way on ${gross.map((k) => NM[k]).join(', ')} and not after: a before-cost tilt is not an edge. ` : '')
    + (npass ? 'A passing market or pool is paper research only, at most a hypothesis for a forward record with its own pre-registration; nothing live changes.'
      : 'Nothing passes: the breakout\'s early-hours gain on gold and USD/JPY does not carry to the Asian index CFDs on this evidence. Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'asia-index-vol-breakout', built: new Date().toISOString().slice(0, 10), preregistration: 'research/edge/asia-index-vol-breakout/PREREGISTRATION.md', planSha256: sha,
    original: { file: 'research/edge/index-vol-breakout/original.mjs', sha256: osha },
    rule: 'gold-vol-breakout T1 unchanged: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange, sell stop O − 0.5 × prevRange, live 00:00-20:55 UTC, first filled wins; stop back at O (worst case in the fill candle); out at the close of the last candle before 21:00 UTC; days under 200 candles or without a 00:00-00:55 candle skipped',
    costs: 'round trip 0.04 % of the entry price (gotobi-jp225\'s figure, assumed, not measured on the demo account), 2x reported; financing per 22:00 UTC rollover by index-vol-breakout\'s formula (DGS2 assumed 5 %): no trade crosses 22:00 UTC, so 0',
    data: `OANDA mid M5 through the candle proxy (edgekit cache): ${Object.entries(spans).map(([k, s]) => `${k} ${s.rows} rows ${s.from} → ${s.to} (${s.weekdays} weekdays built)`).join('; ')}; trading days to ${dataEnd}`,
    dataEnd, firstDay, windows: { D: ['start', '2015-12-31'], C: [WINDOWS.C[0], dataEnd] }, verdict: verdictLine(S, dec), decision: dec, stats: S, skips: skipsAll, early,
    placebo: Object.fromEntries(Object.keys(pl).map((k) => [k, { seeds: SEEDS, start: '01:00-18:00 UTC', means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])),
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  console.log(JSON.stringify(dec));
  void DATA_DIR;
}
