// Edge research · pgm-vol-breakout: the gold-vol-breakout study's T1 (UTC open ± 0.5 × the previous folded day's range, stop
// back at the open, out at 21:00 UTC), unchanged, on OANDA platinum (XPT/USD) and palladium (XPD/USD) M5, as fixed in
// PREREGISTRATION.md. Every trading function comes from original.mjs, a verbatim copy of that study's run.mjs (sha256 pinned in
// tests/pgm-vol-breakout.test.mjs); this file only sets the windows and the cost per day (a share of the day's open), runs the
// two tests, the placebos and the descriptive comparison with XAU/USD, and writes the report.
//   node --use-env-proxy research/edge/pgm-vol-breakout/run.mjs fetch <dir>   (writes <dir>/xpt-5m.json.gz, xpd-5m.json.gz)
//   node research/edge/pgm-vol-breakout/run.mjs <dir> [<xauDir>]
//     <xauDir>/xau-5m.json.gz   OANDA mid XAU/USD M5 rows (the replicate study's cache; descriptive comparison only)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';

export const T1 = O.TESTS.T1;
export const MARKETS = {
  xpt: { name: 'Platinum (XPT/USD)', costPct: 0.0030 },
  xpd: { name: 'Palladium (XPD/USD)', costPct: 0.0080 },
};
export const END = '2026-10-31', IS_END = '2016-12-31', OOS_START = '2017-01-01';
export const MULTS = [0.5, 1, 2];
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
const DAY = 86400;
export const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the first full calendar month served: the 1st of the month after the first candle, or that month if it starts at 00:00 on the 1st
export function firstFullMonth(t0) {
  const d = new Date(t0 * 1000);
  if (d.getUTCDate() === 1 && t0 % DAY === 0) return ymdOf(t0);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}
export const windowsOf = (from) => ({ ALL: [from, END], IS: [from, IS_END], OOS: [OOS_START, END] });

// the cost of one day's trade: pct × the day's open (known before any order)
export const costFn = (pct, mult = 1) => (d) => mult * pct * d.bars[0].o;

// the original's loader: sort, drop the forming last day, build folded days
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  return { days: O.buildDays(rows.filter((r) => r[0] < lastFull)), dataEnd: ymdOf(lastFull - DAY), first: rows[0][0] };
}

// T1 trades on the days inside window w; cost = a function of the day or a constant (the XAU/USD reference)
export function tradesIn(days, w, cost, test = T1) {
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
export function placeboIn(pool, cost, test = T1, seeds = O.SEEDS) {
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

// the pre-registered decision, per market, Holm over the markets given
export function decide(per) {
  const ks = Object.keys(per), p5 = (v) => Math.round(v * 1e5) / 1e5;
  const ps = ks.map((k) => O.normP(per[k].ALL.t)), adj = O.holm(ps), out = {};
  ks.forEach((k, i) => {
    const { ALL, IS, OOS, pl } = per[k], beaten = pl.filter((v) => ALL.netR > v).length;
    const checks = { t2: ALL.t >= 2, holm: adj[i] < 0.05, isPos: IS.netR > 0, oosPos: OOS.netR > 0, cost2x: ALL.net2R > 0, placebo: beaten >= 38, n30: IS.n >= 30 && OOS.n >= 30 };
    out[k] = { p: p5(ps[i]), pHolm: p5(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return out;
}
export const failed = (dec) => Object.entries(dec.checks).filter(([, v]) => !v).map(([c]) => c);

export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
export function compare(m, usd) {
  const u = new Map(usd.map((x) => [x.day, x])), pairs = m.filter((x) => u.has(x.day)).map((x) => [x, u.get(x.day)]);
  const same = pairs.filter(([a, b]) => a.side === b.side).length;
  return { days: pairs.length, metalOnly: m.length - pairs.length, usdOnly: usd.length - pairs.length,
    corrGross: r3(pearson(pairs.map((p) => p[0].R), pairs.map((p) => p[1].R))),
    corrNet: r3(pearson(pairs.map((p) => p[0].net), pairs.map((p) => p[1].net))),
    sameSide: r3(same / (pairs.length || 1)) };
}

// net R a trade at a cost multiple, from a trade's gross R and its 1x cost / financing
export const netAt = (x, mult) => x.R - mult * (x.cost / x.r) - mult * x.finR;
export function multRow(tr, mult) {
  const a = tr.map((x) => ({ day: x.day, v: netAt(x, mult) }));
  return { mult, netR: r3(mean(a.map((x) => x.v))), t: r2(O.monthT(a, 'v').t) };
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(R) {
  const d = R.decision, M = R.markets, n = Object.values(d).filter((x) => x.pass).length;
  const part = (k) => `${k === 'xpt' ? 'platinum' : 'palladium'} ${sg(M[k].ALL.netR)}R net (t ${s2(M[k].ALL.t)}, gross t ${s2(M[k].ALL.grossT)})`;
  return `${n === 2 ? 'PASS' : 'FAIL'}, ${n} of 2: gold's T1 breakout on ${part('xpt')}, ${part('xpd')}`;
}
export function report(R) {
  const L = [], yn = (b) => (b ? 'yes' : 'no'), M = R.markets;
  const row = (lab, x) => `| ${lab} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`;
  L.push('# Platinum and palladium: gold-vol-breakout\'s T1 rule, unchanged', '');
  L.push('Paper research only. A supporting robustness check for the gold rule (`gold-vol-breakout` T1, passed on XAU/USD 2007-15, branch `gold-vol-breakout-replicate`): is the daily volatility breakout a precious-metals effect, or gold\'s alone? The same rule on the other two precious metals. Not a rule for these markets, never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. The markets, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `original.mjs`, a verbatim copy of the original study\'s `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  for (const k of Object.keys(M)) {
    const m = M[k];
    L.push(`## ${m.name}, T1 (cost ${(m.costPct * 100).toFixed(2)} % of price a round trip)`, '');
    L.push('| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop $ |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    L.push(row(`${m.windows.ALL[0].slice(0, 7)} → 2026-10 (pooled)`, m.ALL), row(`${m.windows.IS[0].slice(0, 7)} → 2016-12 (IS)`, m.IS), row('2017-01 → 2026-10 (OOS)', m.OOS));
    L.push('', `Cost multiples, pooled: ${m.mults.map((x) => `${x.mult}x ${sg(x.netR)}R (t ${s2(x.t)})`).join(', ')}. Buys n ${m.ALL.buys.n} ${sg(m.ALL.buys.netR)}R, sells n ${m.ALL.sells.n} ${sg(m.ALL.sells.netR)}R; financing ${sg(m.ALL.finR)}R a trade. First candle served ${m.firstCandle}. Days without a trade: ${Object.entries(m.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`, '');
  }
  L.push('## Decision (pooled per market, Holm over the two markets)', '');
  L.push('| Market | p (one-sided) | Holm p | t ≥ 2 | Holm < 0.05 | IS > 0 | OOS > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each half | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${M[k].name} | ${d.p} | ${d.pHolm} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.oosPos)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Placebo (pooled window, 40 seeds)', '', 'The original study\'s placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same cost per day.', '');
  L.push('| Market | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|---|');
  for (const k of Object.keys(M)) { const p = R.placebo[k]; L.push(`| ${M[k].name} | ${sg(M[k].ALL.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## By year (net and gross R a trade, n)', '');
  const ys = [...new Set(Object.values(M).flatMap((m) => Object.keys(m.ALL.byYear)))].sort();
  const uy = R.reference ? R.reference.ALL.byYear : {};
  L.push('| Year | Platinum net | Platinum gross | Palladium net | Palladium gross | XAU/USD net (n) |', '|---|---|---|---|---|---|');
  for (const y of ys) {
    const c = (k, f) => { const b = M[k].ALL.byYear[y]; return b ? `${sg(b[f])}${f === 'netR' ? ` (${b.n})` : ''}` : '—'; };
    L.push(`| ${y} | ${c('xpt', 'netR')} | ${c('xpt', 'grossR')} | ${c('xpd', 'netR')} | ${c('xpd', 'grossR')} | ${uy[y] ? `${sg(uy[y].netR)} (${uy[y].n})` : '—'} |`);
  }
  if (R.reference) {
    const U = R.reference;
    L.push('', '## Against XAU/USD (descriptive, pre-registered)', '');
    L.push(`The same T1 on OANDA XAU/USD M5 (the replicate study's cache, from ${U.from}), $0.60 a round trip.`, '');
    L.push('| Market | Period | n | Net R/trade | Gross R/trade | t (months) | Gross t |', '|---|---|---|---|---|---|---|');
    for (const w of ['ALL', 'IS', 'OOS']) L.push(`| XAU/USD | ${w === 'ALL' ? `pooled (${U.windows.ALL[0].slice(0, 7)} on)` : w} | ${U[w].n} | ${sg(U[w].netR)} | ${sg(U[w].grossR)} | ${s2(U[w].t)} | ${s2(U[w].grossT)} |`);
    L.push('');
    for (const k of Object.keys(M)) { const C = R.comparison[k]; L.push(`- ${M[k].name}: ${C.days} days both took a T1 trade (metal only ${C.metalOnly}, XAU/USD only ${C.usdOnly}); daily correlation of gross R ${C.corrGross}, of net R ${C.corrNet}; same side ${(C.sameSide * 100).toFixed(1)} % of those days.`); }
  }
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push('- Costs: platinum 0.30 %, palladium 0.80 % of the day\'s open a round trip (the repository\'s CFD cost model for these metals in `research/edge/ict-breadth-2/preregistration.md`, from typical OANDA spreads of about 0.22 % and 0.6 %; stated, not measured), 0.5x / 1x / 2x reported; financing `FIN.xau.long` × `nights` on buys, assumed (no trade crosses the 22:00 UTC rollover: 0).');
  L.push('- To repeat: `node --use-env-proxy research/edge/pgm-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/pgm-vol-breakout/run.mjs <dir> <xauDir>` (`<xauDir>/xau-5m.json.gz` = the replicate study\'s XAU/USD cache); candle caches stay out of the repository.');
  return L.join('\n') + '\n';
}

// ─── fetch: OANDA mid M5 through the keyless candle proxy, in windows ───
async function fetchOne(dir, sym) {
  const start = Date.parse('2004-01-01') / 1000, end = Math.floor(Date.now() / 1000), W = 4500 * 300, wins = [], rows = new Map();
  for (let a = start; a < end; a += W) wins.push([a, Math.min(a + W, end)]);
  const one = async ([a, b]) => {
    for (let k = 0; k < 6; k++) {
      try {
        const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=5m&from=${a}&to=${b}`);
        if (r.status === 429 || r.status >= 500) throw new Error('status ' + r.status);
        const j = await r.json(); for (const x of j.bars || []) if (x.time >= a && x.time < b) rows.set(x.time, [x.time, x.open, x.high, x.low, x.close, x.volume]);
        return;
      } catch { await new Promise((s) => setTimeout(s, 2000 * (k + 1))); }
    }
    throw new Error(sym + ' failed window ' + a);
  };
  for (let i = 0; i < wins.length; i += 4) { await Promise.all(wins.slice(i, i + 4).map(one)); await new Promise((s) => setTimeout(s, 400)); }
  const out = [...rows.values()].sort((x, y) => x[0] - y[0]);
  fs.writeFileSync(path.join(dir, `${sym}-5m.json.gz`), zlib.gzipSync(JSON.stringify(out)));
  console.log(sym, out.length, 'rows', ymdOf(out[0][0]), '→', ymdOf(out.at(-1)[0]));
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] === 'fetch') { fs.mkdirSync(process.argv[3], { recursive: true }); for (const k of Object.keys(MARKETS)) await fetchOne(process.argv[3], k); process.exit(0); }
  const dir = process.argv[2], xauDir = process.argv[3]; if (!dir) throw new Error('usage: node run.mjs <dir> [<xauDir>]');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const markets = {}, per = {}, trades = {}, built = [];
  for (const [k, m] of Object.entries(MARKETS)) {
    const { days, dataEnd, first } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`)))));
    const from = firstFullMonth(first), W = windowsOf(from), cost = costFn(m.costPct);
    const { tr, skips, pool } = tradesIn(days, W.ALL, cost);
    const out = { name: m.name, costPct: m.costPct, firstCandle: new Date(first * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', dataEnd, windows: W, eligibleDays: pool.length, skips };
    for (const w of ['ALL', 'IS', 'OOS']) {
      out[w] = O.summary(tr.filter((x) => inW(x.day, W[w])));
      for (const y of Object.keys(out[w].byYear)) out[w].byYear[y].grossR = r3(mean(tr.filter((x) => x.day.startsWith(y)).map((x) => x.R)));
    }
    out.mults = MULTS.map((x) => multRow(tr, x));
    out.multsOOS = MULTS.map((x) => multRow(tr.filter((t) => inW(t.day, W.OOS)), x));
    const pl = placeboIn(pool, cost);
    markets[k] = out; per[k] = { ALL: out.ALL, IS: out.IS, OOS: out.OOS, pl }; trades[k] = tr;
    built.push(`${m.name} ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}`);
  }
  const dec = decide(per);
  let reference = null, comparison = null;
  if (xauDir) {
    const u = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(xauDir, 'xau-5m.json.gz')))));
    const from = [u.days[0].day, ...Object.values(markets).map((m) => m.windows.ALL[0])].sort()[0];
    const W = windowsOf(from), ut = tradesIn(u.days, W.ALL, O.COST).tr;
    reference = { from: u.days[0].day, cost: O.COST, windows: W };
    for (const w of ['ALL', 'IS', 'OOS']) reference[w] = O.summary(ut.filter((x) => inW(x.day, W[w])));
    comparison = Object.fromEntries(Object.keys(markets).map((k) => [k, compare(trades[k], ut)]));
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const pr = {}; for (const k of Object.keys(markets)) { const pl = per[k].pl; pr[k] = { seeds: O.SEEDS, start: '01:00-18:00 UTC', means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)) }; }
  const R0 = { markets, decision: dec };
  const line = (k) => { const m = markets[k], d = dec[k]; return `${m.name}: pooled ${sg(m.ALL.netR)}R a trade net (n ${m.ALL.n}, month t ${s2(m.ALL.t)}; gross ${sg(m.ALL.grossR)}R, gross t ${s2(m.ALL.grossT)}); IS ${sg(m.IS.netR)}R net / ${sg(m.IS.grossR)}R gross (n ${m.IS.n}, gross t ${s2(m.IS.grossT)}); OOS ${sg(m.OOS.netR)}R net / ${sg(m.OOS.grossR)}R gross (n ${m.OOS.n}, gross t ${s2(m.OOS.grossT)}); costs ${sg(m.ALL.costR).replace('+', '')}R a trade; at 0.5x cost ${sg(m.mults[0].netR)}R (t ${s2(m.mults[0].t)}); ${d.placeboBeaten} of 40 placebo seeds beaten (median ${sg(r3(O.quantile(per[k].pl, 0.5)))}R)${d.pass ? '; passes' : `; failed: ${failed(d).join(', ')}`}.`; };
  const gx = (k) => markets[k].ALL.grossT, both = (k) => markets[k].IS.grossT >= 2 && markets[k].OOS.grossT >= 2;
  const nPass = Object.values(dec).filter((x) => x.pass).length;
  const mech = Object.keys(markets).filter((k) => both(k)), none = Object.keys(markets).every((k) => gx(k) < 2);
  let reading = `${line('xpt')} ${line('xpd')} `;
  if (nPass === 2) reading += 'Both metals pass: by the pre-registered reading the breakout is a precious-metals mechanism, of which gold is the cheapest to trade. ';
  else if (mech.length) reading += `Before costs the breakout shows on ${mech.map((k) => markets[k].name).join(' and ')} in both halves (gross month t ≥ 2 each), so by the pre-registered reading the mechanism is a precious-metals one and the wider CFD cost, not the absence of the move, keeps it from paying. `
    + Object.keys(markets).filter((k) => !both(k)).map((k) => `On ${markets[k].name} the gross pooled month t is ${s2(gx(k))} but IS ${s2(markets[k].IS.grossT)} / OOS ${s2(markets[k].OOS.grossT)}, so it shows there less firmly. `).join('')
    + `The placebo pays the same cost, so its net seeds are deeply negative too and the real streams beating ${Object.keys(markets).map((k) => dec[k].placeboBeaten).join(' and ')} of 40 of them says little; the gross t is the pre-registered measure of the mechanism here. `;
  else if (none) reading += 'Neither metal shows it before costs (pooled gross month t under 2 on both): by the pre-registered reading the gold result is gold\'s alone; with silver\'s gross result (t 3.37, costs larger) it reads as gold and silver, not the platinum group. ';
  else reading += 'Before costs the picture is mixed (a pooled gross t of 2 or more, but not in both halves): described as it is, neither of the two pre-registered readings applies cleanly. ';
  if (comparison) reading += `On the days both traded, the metal's T1 result correlates with XAU/USD's at ${Object.keys(markets).map((k) => `${comparison[k].corrGross} (${k === 'xpt' ? 'platinum' : 'palladium'}, same side ${(comparison[k].sameSide * 100).toFixed(0)} %)`).join(' and ')} in gross R. `;
  reading += 'The costs are the repository\'s stated CFD model for these metals, not a measured spread. This is a check of the gold rule, not a rule for these markets: nothing live changes and no proposal is written.';
  const result = { study: 'pgm-vol-breakout', built: '2026-11-14', preregistration: 'research/edge/pgm-vol-breakout/PREREGISTRATION.md', planSha256: sha, originalSha256: osha,
    claim: 'gold-vol-breakout\'s T1 rule (a move of 0.5 × the previous day\'s range away from the UTC open continues to 21:00 UTC) also holds on platinum and palladium, so the gold result is a precious-metals effect',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close',
    data: `OANDA mid XPT/USD and XPD/USD M5 through the keyless candle proxy; ${built.join('; ')}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    markets, decision: dec, placebo: pr, reference, comparison, reading };
  result.verdict = verdictLine(R0);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(markets)) for (const w of ['ALL', 'IS', 'OOS']) { const x = markets[k][w]; console.log(k, w, JSON.stringify({ n: x.n, net: x.netR, gross: x.grossR, t: x.t, gt: x.grossT, n2: x.net2R, cost: x.costR })); }
  console.log(JSON.stringify(dec), JSON.stringify(comparison), reference && JSON.stringify({ ALL: [reference.ALL.n, reference.ALL.netR, reference.ALL.t] }));
}
